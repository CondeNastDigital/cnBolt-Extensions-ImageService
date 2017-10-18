(function() {
/** vim: et:ts=4:sw=4:sts=4
 * @license RequireJS 2.3.5 Copyright jQuery Foundation and other contributors.
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
        version = '2.3.5',
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
            service: options.defaults.service,
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

            var result = JSON.parse(JSON.stringify(model));
            presetters.forEach(function (presetter) {
                presetter.apply(result);
            });

            return Object.assign(result, defaults);
        };

        that.init();
    }
});
define( 'ImageServiceUniqueId',[],function () {

    return function(prefix) {

        var that = this;

        that.prefix = prefix;

        that.generate =  function(input) {
            var result = (that.prefix? that.prefix + '_': '');
            return  result + String(input).replace(/[^a-z0-9\_\-]+/ig, '');
        };

        return that;

    }

});
define('ImageServiceListItemFactory',["ImageServiceUniqueId"],function (ImageServiceUniqueId) {

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
        var service = data.service;

        that.create = function (options) {

            var idGenerator = new ImageServiceUniqueId(options.prefix);

            return new Model(
                Object.assign({
                        config: {
                            events: Events
                        },
                        factory: {
                            dataModel: DataModel,
                            attributes: Attributes,
                            idGenerator: idGenerator
                        },
                        model: {
                            actions: Actions,
                            preview: Preview
                        },
                        definitions: attributeDefinition,
                        service: service
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
    return function (data) {

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
         * The name of the service that will be used to deal with the images - cloudinary for example
         * @type {*}
         */
        that.serviceName = data.serviceName;

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
                        if(!warningCallback(response.messages, response.items))
                            return;

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

        /**
         * Gets an image url
         * TODO: Remove as its not needed. The url comes back on item create
         *
         * @param imageId
         * @returns {Promise}
         */
        that.getImageUrl = function (imageId) {

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
                        service: that.serviceName
                    },
                    success: function (data) {
                        deferred.resolve(data.url);
                    }
                });

            }

            return deferred.promise;
        };

        /**
         * Finds an image of the service
         * @param params
         * @returns {Promise}
         */
        that.imageFind = function (params) {

            var deferred = {};
            deferred.promise = new Promise(function (resolve, reject) {
                deferred.resolve = resolve;
                deferred.reject = reject;
            });

            var search = Object.assign(
                {
                    service: that.serviceName
                },
                params
            );

            $.ajax({
                url: that.baseUrl + '/imagesearch',
                data: search,
                success: function (data) {
                    deferred.resolve(data);
                },
                error: function (data) {
                    deferred.reject(data);
                }
            });

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
        var store = options.data;
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

            var result = [];

            components.forEach(function (el) {
                result[el.getIdentifier()] = el.getValues();
            });

            return result;
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
    return function (data) {

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
                    //url: that.dataService.baseUrl + "/imagesearch",
                    //dataType: 'json',
                    delay: 120,

                    data: function (params) {
                        return {
                            q: params.term.replace(/(^\s+)|(\s+$)/igm, ''), // search term, trimmed
                            page: params.page
                        };
                    },
                    transport: function (params, success, failure) {
                        return that.dataService.imageFind(params.data)
                            .then(success)
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

        that.name = 'defaults';

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
            delete values['tags'];

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
            error: data.events.error || 'imageservice-error',
            warning: data.events.warning || 'imageservice-warning',
            info: data.events.info || 'imageservice-info'
        };

        /**
         * Constructor
         */
        that.init = function () {

            that.host.prepend(that.container);

            that.host.on(that.events.error, function (event, data) {
                var message = data;

                if(data instanceof Object)
                    message = data.error;

                that.error(message);

            });

            that.host.on(that.events.info, function (event, data) {

                var message = data;

                if(data instanceof Object)
                    message = data.error;

                that.info(message);

            });

            that.host.on(that.events.warning, function (event, data) {
                var message = data;

                if(data instanceof Object)
                    message = data.error;

                that.warning(message);

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
                    update: that.onListSorted,
                    cancel: '.no-drag'
                });
            }

            that.dirty = false;
        };

        /**
         * Registers the listeners
         */
        that.addListeners = function () {

            // On list saved
            $(that.host).on(Events.LISTSAVED, function (event, newItems) {
                that.reset(newItems.items);
            });

            // On element change
            $(that.host).on('change', function (event) {
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
            if (that.maxItems == 1 && that.getListLength() >= that.maxItems) {
                that.imageEntities[0].onItemDelete(false);
            } else if (that.maxItems && that.getListLength() >= that.maxItems) {
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
        LISTSAVEFAILED: 'imageservice-listsavefailed',
        LISTCHANGED: 'imageservice-listchanged',
        LISTREADY: 'imageservice-listready',
        LISTREMOVED: 'imageservice-listremoved',
        LISTSAVINGSKIPPED: 'imageservice-listsavingskipped',
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
            fileexists:  'The image alsready exists. The existing copy has been taken. ',
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
        that.name = 'globals';

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
        var EventsArena = data.eventsArena;
        var IdGenerator = data.factory.idGenerator;

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
        var dataService = data.service;

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
            id = that.generateId(item.id);//data.prefix + '_' + item.id.replace(/[^a-z0-9\_\-]+/ig, '_');

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

        that.generateId = function(itemId) {
            return IdGenerator.generate(itemId);
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

            // exclude
            $(window).on(Events.MESSAGEERROR, function (event, error) {
                if(that.generateId(error.data.id) === that.getId()) {
                    container.addClass('error');
                }
            });

            $(window).on(Events.MESSAGEWARNING, function (event, warning) {
                if(that.generateId(warning.data.id) === that.getId()) {
                    container.addClass('warning');
                }
            });

        };

        /**
         * TODO: Move this logic to the Item service
         */
        that.presetImage = function () {

            if (!item.info.source && item.status == DataModel.statuses.CLEAN) {
                item.info.source = dataService.getImageUrl(item.id, item.service);
            }

            // Php array - to Javascript object
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

            var previewContainer = $('<div class="col-xs-12 col-sm-3 col-md-3"></div>').append(preview.render());
            var attributesContainer = $('<div class="col-xs-12 col-sm-8 col-md-8"></div>').append(attributes.render());

            container.append(previewContainer);
            container.append(attributesContainer);
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
define('ImageServicePreview',["ImageServiceUniqueId"], function (ImageServiceUniqueId) {

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
        var IdGenerator = new ImageServiceUniqueId('');

        /**
         * Tries to get the item path form the
         */
        that.init = function () {

            container = $('<div class="imageservice-preview"></div>');
            preview = $('<img id="'+ IdGenerator.generate(item.id) +'"/>');

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
                    preview.attr('src', String(url).replace(/^http(s?):\/\//i,'//'));
                    item.info.source = url;
                });
            } else if (!(item.info.source instanceof Promise)) {
                preview.attr('src', String(item.info.source).replace(/^http(s?):\/\//i,'//'));
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
define("plugins/core/set-root-p-element",[],function(){"use strict";return function(){return function(t){""===t.getHTML().trim()&&t.setContent("<p><br></p>")}}}),function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define("immutable",e):t.Immutable=e()}(this,function(){"use strict";function t(t,e){e&&(t.prototype=Object.create(e.prototype)),t.prototype.constructor=t}function e(t){return t.value=!1,t}function n(t){t&&(t.value=!0)}function r(){}function i(t,e){e=e||0;for(var n=Math.max(0,t.length-e),r=new Array(n),i=0;n>i;i++)r[i]=t[i+e];return r}function o(t){return void 0===t.size&&(t.size=t.__iterate(s)),t.size}function u(t,e){return e>=0?+e:o(t)+ +e}function s(){return!0}function a(t,e,n){return(0===t||void 0!==n&&-n>=t)&&(void 0===e||void 0!==n&&e>=n)}function c(t,e){return h(t,e,0)}function f(t,e){return h(t,e,e)}function h(t,e,n){return void 0===t?n:0>t?Math.max(0,e+t):void 0===e?t:Math.min(e,t)}function l(t){return _(t)?t:x(t)}function p(t){return v(t)?t:k(t)}function d(t){return y(t)?t:z(t)}function m(t){return _(t)&&!g(t)?t:L(t)}function _(t){return!(!t||!t[mn])}function v(t){return!(!t||!t[_n])}function y(t){return!(!t||!t[vn])}function g(t){return v(t)||y(t)}function b(t){return!(!t||!t[yn])}function w(t){this.next=t}function S(t,e,n,r){var i=0===t?e:1===t?n:[e,n];return r?r.value=i:r={value:i,done:!1},r}function E(){return{value:void 0,done:!0}}function M(t){return!!O(t)}function I(t){return t&&"function"==typeof t.next}function C(t){var e=O(t);return e&&e.call(t)}function O(t){var e=t&&(Sn&&t[Sn]||t[En]);return"function"==typeof e?e:void 0}function N(t){return t&&"number"==typeof t.length}function x(t){return null===t||void 0===t?P():_(t)?t.toSeq():H(t)}function k(t){return null===t||void 0===t?P().toKeyedSeq():_(t)?v(t)?t.toSeq():t.fromEntrySeq():j(t)}function z(t){return null===t||void 0===t?P():_(t)?v(t)?t.entrySeq():t.toIndexedSeq():B(t)}function L(t){return(null===t||void 0===t?P():_(t)?v(t)?t.entrySeq():t:B(t)).toSetSeq()}function T(t){this._array=t,this.size=t.length}function A(t){var e=Object.keys(t);this._object=t,this._keys=e,this.size=e.length}function D(t){this._iterable=t,this.size=t.length||t.size}function q(t){this._iterator=t,this._iteratorCache=[]}function R(t){return!(!t||!t[In])}function P(){return Cn||(Cn=new T([]))}function j(t){var e=Array.isArray(t)?new T(t).fromEntrySeq():I(t)?new q(t).fromEntrySeq():M(t)?new D(t).fromEntrySeq():"object"==typeof t?new A(t):void 0;if(!e)throw new TypeError("Expected Array or iterable object of [k, v] entries, or keyed object: "+t);return e}function B(t){var e=U(t);if(!e)throw new TypeError("Expected Array or iterable object of values: "+t);return e}function H(t){var e=U(t)||"object"==typeof t&&new A(t);if(!e)throw new TypeError("Expected Array or iterable object of values, or keyed object: "+t);return e}function U(t){return N(t)?new T(t):I(t)?new q(t):M(t)?new D(t):void 0}function F(t,e,n,r){var i=t._cache;if(i){for(var o=i.length-1,u=0;o>=u;u++){var s=i[n?o-u:u];if(e(s[1],r?s[0]:u,t)===!1)return u+1}return u}return t.__iterateUncached(e,n)}function K(t,e,n,r){var i=t._cache;if(i){var o=i.length-1,u=0;return new w(function(){var t=i[n?o-u:u];return u++>o?E():S(e,r?t[0]:u-1,t[1])})}return t.__iteratorUncached(e,n)}function W(){throw TypeError("Abstract")}function J(){}function V(){}function $(){}function G(t,e){if(t===e||t!==t&&e!==e)return!0;if(!t||!e)return!1;if("function"==typeof t.valueOf&&"function"==typeof e.valueOf){if(t=t.valueOf(),e=e.valueOf(),t===e||t!==t&&e!==e)return!0;if(!t||!e)return!1}return"function"==typeof t.equals&&"function"==typeof e.equals&&t.equals(e)?!0:!1}function Q(t,e){return e?X(e,t,"",{"":t}):Y(t)}function X(t,e,n,r){return Array.isArray(e)?t.call(r,n,z(e).map(function(n,r){return X(t,n,r,e)})):Z(e)?t.call(r,n,k(e).map(function(n,r){return X(t,n,r,e)})):e}function Y(t){return Array.isArray(t)?z(t).map(Y).toList():Z(t)?k(t).map(Y).toMap():t}function Z(t){return t&&(t.constructor===Object||void 0===t.constructor)}function tt(t){return t>>>1&1073741824|3221225471&t}function et(t){if(t===!1||null===t||void 0===t)return 0;if("function"==typeof t.valueOf&&(t=t.valueOf(),t===!1||null===t||void 0===t))return 0;if(t===!0)return 1;var e=typeof t;if("number"===e){var n=0|t;for(n!==t&&(n^=4294967295*t);t>4294967295;)t/=4294967295,n^=t;return tt(n)}return"string"===e?t.length>An?nt(t):rt(t):"function"==typeof t.hashCode?t.hashCode():it(t)}function nt(t){var e=Rn[t];return void 0===e&&(e=rt(t),qn===Dn&&(qn=0,Rn={}),qn++,Rn[t]=e),e}function rt(t){for(var e=0,n=0;n<t.length;n++)e=31*e+t.charCodeAt(n)|0;return tt(e)}function it(t){var e;if(zn&&(e=On.get(t),void 0!==e))return e;if(e=t[Tn],void 0!==e)return e;if(!kn){if(e=t.propertyIsEnumerable&&t.propertyIsEnumerable[Tn],void 0!==e)return e;if(e=ot(t),void 0!==e)return e}if(e=++Ln,1073741824&Ln&&(Ln=0),zn)On.set(t,e);else{if(void 0!==xn&&xn(t)===!1)throw new Error("Non-extensible objects are not allowed as keys.");if(kn)Object.defineProperty(t,Tn,{enumerable:!1,configurable:!1,writable:!1,value:e});else if(void 0!==t.propertyIsEnumerable&&t.propertyIsEnumerable===t.constructor.prototype.propertyIsEnumerable)t.propertyIsEnumerable=function(){return this.constructor.prototype.propertyIsEnumerable.apply(this,arguments)},t.propertyIsEnumerable[Tn]=e;else{if(void 0===t.nodeType)throw new Error("Unable to set a non-enumerable property on object.");t[Tn]=e}}return e}function ot(t){if(t&&t.nodeType>0)switch(t.nodeType){case 1:return t.uniqueID;case 9:return t.documentElement&&t.documentElement.uniqueID}}function ut(t,e){if(!t)throw new Error(e)}function st(t){ut(t!==1/0,"Cannot perform this action with an infinite size.")}function at(t,e){this._iter=t,this._useKeys=e,this.size=t.size}function ct(t){this._iter=t,this.size=t.size}function ft(t){this._iter=t,this.size=t.size}function ht(t){this._iter=t,this.size=t.size}function lt(t){var e=Tt(t);return e._iter=t,e.size=t.size,e.flip=function(){return t},e.reverse=function(){var e=t.reverse.apply(this);return e.flip=function(){return t.reverse()},e},e.has=function(e){return t.includes(e)},e.includes=function(e){return t.has(e)},e.cacheResult=At,e.__iterateUncached=function(e,n){var r=this;return t.__iterate(function(t,n){return e(n,t,r)!==!1},n)},e.__iteratorUncached=function(e,n){if(e===wn){var r=t.__iterator(e,n);return new w(function(){var t=r.next();if(!t.done){var e=t.value[0];t.value[0]=t.value[1],t.value[1]=e}return t})}return t.__iterator(e===bn?gn:bn,n)},e}function pt(t,e,n){var r=Tt(t);return r.size=t.size,r.has=function(e){return t.has(e)},r.get=function(r,i){var o=t.get(r,ln);return o===ln?i:e.call(n,o,r,t)},r.__iterateUncached=function(r,i){var o=this;return t.__iterate(function(t,i,u){return r(e.call(n,t,i,u),i,o)!==!1},i)},r.__iteratorUncached=function(r,i){var o=t.__iterator(wn,i);return new w(function(){var i=o.next();if(i.done)return i;var u=i.value,s=u[0];return S(r,s,e.call(n,u[1],s,t),i)})},r}function dt(t,e){var n=Tt(t);return n._iter=t,n.size=t.size,n.reverse=function(){return t},t.flip&&(n.flip=function(){var e=lt(t);return e.reverse=function(){return t.flip()},e}),n.get=function(n,r){return t.get(e?n:-1-n,r)},n.has=function(n){return t.has(e?n:-1-n)},n.includes=function(e){return t.includes(e)},n.cacheResult=At,n.__iterate=function(e,n){var r=this;return t.__iterate(function(t,n){return e(t,n,r)},!n)},n.__iterator=function(e,n){return t.__iterator(e,!n)},n}function mt(t,e,n,r){var i=Tt(t);return r&&(i.has=function(r){var i=t.get(r,ln);return i!==ln&&!!e.call(n,i,r,t)},i.get=function(r,i){var o=t.get(r,ln);return o!==ln&&e.call(n,o,r,t)?o:i}),i.__iterateUncached=function(i,o){var u=this,s=0;return t.__iterate(function(t,o,a){return e.call(n,t,o,a)?(s++,i(t,r?o:s-1,u)):void 0},o),s},i.__iteratorUncached=function(i,o){var u=t.__iterator(wn,o),s=0;return new w(function(){for(;;){var o=u.next();if(o.done)return o;var a=o.value,c=a[0],f=a[1];if(e.call(n,f,c,t))return S(i,r?c:s++,f,o)}})},i}function _t(t,e,n){var r=Rt().asMutable();return t.__iterate(function(i,o){r.update(e.call(n,i,o,t),0,function(t){return t+1})}),r.asImmutable()}function vt(t,e,n){var r=v(t),i=(b(t)?Ee():Rt()).asMutable();t.__iterate(function(o,u){i.update(e.call(n,o,u,t),function(t){return t=t||[],t.push(r?[u,o]:o),t})});var o=Lt(t);return i.map(function(e){return xt(t,o(e))})}function yt(t,e,n,r){var i=t.size;if(a(e,n,i))return t;var o=c(e,i),s=f(n,i);if(o!==o||s!==s)return yt(t.toSeq().cacheResult(),e,n,r);var h,l=s-o;l===l&&(h=0>l?0:l);var p=Tt(t);return p.size=h,!r&&R(t)&&h>=0&&(p.get=function(e,n){return e=u(this,e),e>=0&&h>e?t.get(e+o,n):n}),p.__iterateUncached=function(e,n){var i=this;if(0===h)return 0;if(n)return this.cacheResult().__iterate(e,n);var u=0,s=!0,a=0;return t.__iterate(function(t,n){return s&&(s=u++<o)?void 0:(a++,e(t,r?n:a-1,i)!==!1&&a!==h)}),a},p.__iteratorUncached=function(e,n){if(0!==h&&n)return this.cacheResult().__iterator(e,n);var i=0!==h&&t.__iterator(e,n),u=0,s=0;return new w(function(){for(;u++<o;)i.next();if(++s>h)return E();var t=i.next();return r||e===bn?t:e===gn?S(e,s-1,void 0,t):S(e,s-1,t.value[1],t)})},p}function gt(t,e,n){var r=Tt(t);return r.__iterateUncached=function(r,i){var o=this;if(i)return this.cacheResult().__iterate(r,i);var u=0;return t.__iterate(function(t,i,s){return e.call(n,t,i,s)&&++u&&r(t,i,o)}),u},r.__iteratorUncached=function(r,i){var o=this;if(i)return this.cacheResult().__iterator(r,i);var u=t.__iterator(wn,i),s=!0;return new w(function(){if(!s)return E();var t=u.next();if(t.done)return t;var i=t.value,a=i[0],c=i[1];return e.call(n,c,a,o)?r===wn?t:S(r,a,c,t):(s=!1,E())})},r}function bt(t,e,n,r){var i=Tt(t);return i.__iterateUncached=function(i,o){var u=this;if(o)return this.cacheResult().__iterate(i,o);var s=!0,a=0;return t.__iterate(function(t,o,c){return s&&(s=e.call(n,t,o,c))?void 0:(a++,i(t,r?o:a-1,u))}),a},i.__iteratorUncached=function(i,o){var u=this;if(o)return this.cacheResult().__iterator(i,o);var s=t.__iterator(wn,o),a=!0,c=0;return new w(function(){var t,o,f;do{if(t=s.next(),t.done)return r||i===bn?t:i===gn?S(i,c++,void 0,t):S(i,c++,t.value[1],t);var h=t.value;o=h[0],f=h[1],a&&(a=e.call(n,f,o,u))}while(a);return i===wn?t:S(i,o,f,t)})},i}function wt(t,e){var n=v(t),r=[t].concat(e).map(function(t){return _(t)?n&&(t=p(t)):t=n?j(t):B(Array.isArray(t)?t:[t]),t}).filter(function(t){return 0!==t.size});if(0===r.length)return t;if(1===r.length){var i=r[0];if(i===t||n&&v(i)||y(t)&&y(i))return i}var o=new T(r);return n?o=o.toKeyedSeq():y(t)||(o=o.toSetSeq()),o=o.flatten(!0),o.size=r.reduce(function(t,e){if(void 0!==t){var n=e.size;if(void 0!==n)return t+n}},0),o}function St(t,e,n){var r=Tt(t);return r.__iterateUncached=function(r,i){function o(t,a){var c=this;t.__iterate(function(t,i){return(!e||e>a)&&_(t)?o(t,a+1):r(t,n?i:u++,c)===!1&&(s=!0),!s},i)}var u=0,s=!1;return o(t,0),u},r.__iteratorUncached=function(r,i){var o=t.__iterator(r,i),u=[],s=0;return new w(function(){for(;o;){var t=o.next();if(t.done===!1){var a=t.value;if(r===wn&&(a=a[1]),e&&!(u.length<e)||!_(a))return n?t:S(r,s++,a,t);u.push(o),o=a.__iterator(r,i)}else o=u.pop()}return E()})},r}function Et(t,e,n){var r=Lt(t);return t.toSeq().map(function(i,o){return r(e.call(n,i,o,t))}).flatten(!0)}function Mt(t,e){var n=Tt(t);return n.size=t.size&&2*t.size-1,n.__iterateUncached=function(n,r){var i=this,o=0;return t.__iterate(function(t,r){return(!o||n(e,o++,i)!==!1)&&n(t,o++,i)!==!1},r),o},n.__iteratorUncached=function(n,r){var i,o=t.__iterator(bn,r),u=0;return new w(function(){return(!i||u%2)&&(i=o.next(),i.done)?i:u%2?S(n,u++,e):S(n,u++,i.value,i)})},n}function It(t,e,n){e||(e=Dt);var r=v(t),i=0,o=t.toSeq().map(function(e,r){return[r,e,i++,n?n(e,r,t):e]}).toArray();return o.sort(function(t,n){return e(t[3],n[3])||t[2]-n[2]}).forEach(r?function(t,e){o[e].length=2}:function(t,e){o[e]=t[1]}),r?k(o):y(t)?z(o):L(o)}function Ct(t,e,n){if(e||(e=Dt),n){var r=t.toSeq().map(function(e,r){return[e,n(e,r,t)]}).reduce(function(t,n){return Ot(e,t[1],n[1])?n:t});return r&&r[0]}return t.reduce(function(t,n){return Ot(e,t,n)?n:t})}function Ot(t,e,n){var r=t(n,e);return 0===r&&n!==e&&(void 0===n||null===n||n!==n)||r>0}function Nt(t,e,n){var r=Tt(t);return r.size=new T(n).map(function(t){return t.size}).min(),r.__iterate=function(t,e){for(var n,r=this.__iterator(bn,e),i=0;!(n=r.next()).done&&t(n.value,i++,this)!==!1;);return i},r.__iteratorUncached=function(t,r){var i=n.map(function(t){return t=l(t),C(r?t.reverse():t)}),o=0,u=!1;return new w(function(){var n;return u||(n=i.map(function(t){return t.next()}),u=n.some(function(t){return t.done})),u?E():S(t,o++,e.apply(null,n.map(function(t){return t.value})))})},r}function xt(t,e){return R(t)?e:t.constructor(e)}function kt(t){if(t!==Object(t))throw new TypeError("Expected [K, V] tuple: "+t)}function zt(t){return st(t.size),o(t)}function Lt(t){return v(t)?p:y(t)?d:m}function Tt(t){return Object.create((v(t)?k:y(t)?z:L).prototype)}function At(){return this._iter.cacheResult?(this._iter.cacheResult(),this.size=this._iter.size,this):x.prototype.cacheResult.call(this)}function Dt(t,e){return t>e?1:e>t?-1:0}function qt(t){var e=C(t);if(!e){if(!N(t))throw new TypeError("Expected iterable or array-like: "+t);e=C(l(t))}return e}function Rt(t){return null===t||void 0===t?$t():Pt(t)?t:$t().withMutations(function(e){var n=p(t);st(n.size),n.forEach(function(t,n){return e.set(n,t)})})}function Pt(t){return!(!t||!t[Pn])}function jt(t,e){this.ownerID=t,this.entries=e}function Bt(t,e,n){this.ownerID=t,this.bitmap=e,this.nodes=n}function Ht(t,e,n){this.ownerID=t,this.count=e,this.nodes=n}function Ut(t,e,n){this.ownerID=t,this.keyHash=e,this.entries=n}function Ft(t,e,n){this.ownerID=t,this.keyHash=e,this.entry=n}function Kt(t,e,n){this._type=e,this._reverse=n,this._stack=t._root&&Jt(t._root)}function Wt(t,e){return S(t,e[0],e[1])}function Jt(t,e){return{node:t,index:0,__prev:e}}function Vt(t,e,n,r){var i=Object.create(jn);return i.size=t,i._root=e,i.__ownerID=n,i.__hash=r,i.__altered=!1,i}function $t(){return Bn||(Bn=Vt(0))}function Gt(t,n,r){var i,o;if(t._root){var u=e(pn),s=e(dn);if(i=Qt(t._root,t.__ownerID,0,void 0,n,r,u,s),!s.value)return t;o=t.size+(u.value?r===ln?-1:1:0)}else{if(r===ln)return t;o=1,i=new jt(t.__ownerID,[[n,r]])}return t.__ownerID?(t.size=o,t._root=i,t.__hash=void 0,t.__altered=!0,t):i?Vt(o,i):$t()}function Qt(t,e,r,i,o,u,s,a){return t?t.update(e,r,i,o,u,s,a):u===ln?t:(n(a),n(s),new Ft(e,i,[o,u]))}function Xt(t){return t.constructor===Ft||t.constructor===Ut}function Yt(t,e,n,r,i){if(t.keyHash===r)return new Ut(e,r,[t.entry,i]);var o,u=(0===n?t.keyHash:t.keyHash>>>n)&hn,s=(0===n?r:r>>>n)&hn,a=u===s?[Yt(t,e,n+cn,r,i)]:(o=new Ft(e,r,i),s>u?[t,o]:[o,t]);return new Bt(e,1<<u|1<<s,a)}function Zt(t,e,n,i){t||(t=new r);for(var o=new Ft(t,et(n),[n,i]),u=0;u<e.length;u++){var s=e[u];o=o.update(t,0,void 0,s[0],s[1])}return o}function te(t,e,n,r){for(var i=0,o=0,u=new Array(n),s=0,a=1,c=e.length;c>s;s++,a<<=1){var f=e[s];void 0!==f&&s!==r&&(i|=a,u[o++]=f)}return new Bt(t,i,u)}function ee(t,e,n,r,i){for(var o=0,u=new Array(fn),s=0;0!==n;s++,n>>>=1)u[s]=1&n?e[o++]:void 0;return u[r]=i,new Ht(t,o+1,u)}function ne(t,e,n){for(var r=[],i=0;i<n.length;i++){var o=n[i],u=p(o);_(o)||(u=u.map(function(t){return Q(t)})),r.push(u)}return ie(t,e,r)}function re(t){return function(e,n,r){return e&&e.mergeDeepWith&&_(n)?e.mergeDeepWith(t,n):t?t(e,n,r):n}}function ie(t,e,n){return n=n.filter(function(t){return 0!==t.size}),0===n.length?t:0!==t.size||t.__ownerID||1!==n.length?t.withMutations(function(t){for(var r=e?function(n,r){t.update(r,ln,function(t){return t===ln?n:e(t,n,r)})}:function(e,n){t.set(n,e)},i=0;i<n.length;i++)n[i].forEach(r)}):t.constructor(n[0])}function oe(t,e,n,r){var i=t===ln,o=e.next();if(o.done){var u=i?n:t,s=r(u);return s===u?t:s}ut(i||t&&t.set,"invalid keyPath");var a=o.value,c=i?ln:t.get(a,ln),f=oe(c,e,n,r);return f===c?t:f===ln?t.remove(a):(i?$t():t).set(a,f)}function ue(t){return t-=t>>1&1431655765,t=(858993459&t)+(t>>2&858993459),t=t+(t>>4)&252645135,t+=t>>8,t+=t>>16,127&t}function se(t,e,n,r){var o=r?t:i(t);return o[e]=n,o}function ae(t,e,n,r){var i=t.length+1;if(r&&e+1===i)return t[e]=n,t;for(var o=new Array(i),u=0,s=0;i>s;s++)s===e?(o[s]=n,u=-1):o[s]=t[s+u];return o}function ce(t,e,n){var r=t.length-1;if(n&&e===r)return t.pop(),t;for(var i=new Array(r),o=0,u=0;r>u;u++)u===e&&(o=1),i[u]=t[u+o];return i}function fe(t){var e=me();if(null===t||void 0===t)return e;if(he(t))return t;var n=d(t),r=n.size;return 0===r?e:(st(r),r>0&&fn>r?de(0,r,cn,null,new le(n.toArray())):e.withMutations(function(t){t.setSize(r),n.forEach(function(e,n){return t.set(n,e)})}))}function he(t){return!(!t||!t[Kn])}function le(t,e){this.array=t,this.ownerID=e}function pe(t,e){function n(t,e,n){return 0===e?r(t,n):i(t,e,n)}function r(t,n){var r=n===s?a&&a.array:t&&t.array,i=n>o?0:o-n,c=u-n;return c>fn&&(c=fn),function(){if(i===c)return Vn;var t=e?--c:i++;return r&&r[t]}}function i(t,r,i){var s,a=t&&t.array,c=i>o?0:o-i>>r,f=(u-i>>r)+1;return f>fn&&(f=fn),function(){for(;;){if(s){var t=s();if(t!==Vn)return t;s=null}if(c===f)return Vn;var o=e?--f:c++;s=n(a&&a[o],r-cn,i+(o<<r))}}}var o=t._origin,u=t._capacity,s=Se(u),a=t._tail;return n(t._root,t._level,0)}function de(t,e,n,r,i,o,u){var s=Object.create(Wn);return s.size=e-t,s._origin=t,s._capacity=e,s._level=n,s._root=r,s._tail=i,s.__ownerID=o,s.__hash=u,s.__altered=!1,s}function me(){return Jn||(Jn=de(0,0,cn))}function _e(t,n,r){if(n=u(t,n),n>=t.size||0>n)return t.withMutations(function(t){0>n?be(t,n).set(0,r):be(t,0,n+1).set(n,r)});n+=t._origin;var i=t._tail,o=t._root,s=e(dn);return n>=Se(t._capacity)?i=ve(i,t.__ownerID,0,n,r,s):o=ve(o,t.__ownerID,t._level,n,r,s),s.value?t.__ownerID?(t._root=o,t._tail=i,t.__hash=void 0,t.__altered=!0,t):de(t._origin,t._capacity,t._level,o,i):t}function ve(t,e,r,i,o,u){var s=i>>>r&hn,a=t&&s<t.array.length;if(!a&&void 0===o)return t;var c;if(r>0){var f=t&&t.array[s],h=ve(f,e,r-cn,i,o,u);return h===f?t:(c=ye(t,e),c.array[s]=h,c)}return a&&t.array[s]===o?t:(n(u),c=ye(t,e),void 0===o&&s===c.array.length-1?c.array.pop():c.array[s]=o,c)}function ye(t,e){return e&&t&&e===t.ownerID?t:new le(t?t.array.slice():[],e)}function ge(t,e){if(e>=Se(t._capacity))return t._tail;if(e<1<<t._level+cn){for(var n=t._root,r=t._level;n&&r>0;)n=n.array[e>>>r&hn],r-=cn;return n}}function be(t,e,n){var i=t.__ownerID||new r,o=t._origin,u=t._capacity,s=o+e,a=void 0===n?u:0>n?u+n:o+n;if(s===o&&a===u)return t;if(s>=a)return t.clear();for(var c=t._level,f=t._root,h=0;0>s+h;)f=new le(f&&f.array.length?[void 0,f]:[],i),c+=cn,h+=1<<c;h&&(s+=h,o+=h,a+=h,u+=h);for(var l=Se(u),p=Se(a);p>=1<<c+cn;)f=new le(f&&f.array.length?[f]:[],i),c+=cn;var d=t._tail,m=l>p?ge(t,a-1):p>l?new le([],i):d;if(d&&p>l&&u>s&&d.array.length){f=ye(f,i);for(var _=f,v=c;v>cn;v-=cn){var y=l>>>v&hn;_=_.array[y]=ye(_.array[y],i)}_.array[l>>>cn&hn]=d}if(u>a&&(m=m&&m.removeAfter(i,0,a)),s>=p)s-=p,a-=p,c=cn,f=null,m=m&&m.removeBefore(i,0,s);else if(s>o||l>p){for(h=0;f;){var g=s>>>c&hn;if(g!==p>>>c&hn)break;g&&(h+=(1<<c)*g),c-=cn,f=f.array[g]}f&&s>o&&(f=f.removeBefore(i,c,s-h)),f&&l>p&&(f=f.removeAfter(i,c,p-h)),h&&(s-=h,a-=h)}return t.__ownerID?(t.size=a-s,t._origin=s,t._capacity=a,t._level=c,t._root=f,t._tail=m,t.__hash=void 0,t.__altered=!0,t):de(s,a,c,f,m)}function we(t,e,n){for(var r=[],i=0,o=0;o<n.length;o++){var u=n[o],s=d(u);s.size>i&&(i=s.size),_(u)||(s=s.map(function(t){return Q(t)})),r.push(s)}return i>t.size&&(t=t.setSize(i)),ie(t,e,r)}function Se(t){return fn>t?0:t-1>>>cn<<cn}function Ee(t){return null===t||void 0===t?Ce():Me(t)?t:Ce().withMutations(function(e){var n=p(t);st(n.size),n.forEach(function(t,n){return e.set(n,t)})})}function Me(t){return Pt(t)&&b(t)}function Ie(t,e,n,r){var i=Object.create(Ee.prototype);return i.size=t?t.size:0,i._map=t,i._list=e,i.__ownerID=n,i.__hash=r,i}function Ce(){return $n||($n=Ie($t(),me()))}function Oe(t,e,n){var r,i,o=t._map,u=t._list,s=o.get(e),a=void 0!==s;if(n===ln){if(!a)return t;u.size>=fn&&u.size>=2*o.size?(i=u.filter(function(t,e){return void 0!==t&&s!==e}),r=i.toKeyedSeq().map(function(t){return t[0]}).flip().toMap(),t.__ownerID&&(r.__ownerID=i.__ownerID=t.__ownerID)):(r=o.remove(e),i=s===u.size-1?u.pop():u.set(s,void 0))}else if(a){if(n===u.get(s)[1])return t;r=o,i=u.set(s,[e,n])}else r=o.set(e,u.size),i=u.set(u.size,[e,n]);return t.__ownerID?(t.size=r.size,t._map=r,t._list=i,t.__hash=void 0,t):Ie(r,i)}function Ne(t){return null===t||void 0===t?ze():xe(t)?t:ze().unshiftAll(t)}function xe(t){return!(!t||!t[Gn])}function ke(t,e,n,r){var i=Object.create(Qn);return i.size=t,i._head=e,i.__ownerID=n,i.__hash=r,i.__altered=!1,i}function ze(){return Xn||(Xn=ke(0))}function Le(t){return null===t||void 0===t?qe():Te(t)?t:qe().withMutations(function(e){var n=m(t);st(n.size),n.forEach(function(t){return e.add(t)})})}function Te(t){return!(!t||!t[Yn])}function Ae(t,e){return t.__ownerID?(t.size=e.size,t._map=e,t):e===t._map?t:0===e.size?t.__empty():t.__make(e)}function De(t,e){var n=Object.create(Zn);return n.size=t?t.size:0,n._map=t,n.__ownerID=e,n}function qe(){return tr||(tr=De($t()))}function Re(t){return null===t||void 0===t?Be():Pe(t)?t:Be().withMutations(function(e){var n=m(t);st(n.size),n.forEach(function(t){return e.add(t)})})}function Pe(t){return Te(t)&&b(t)}function je(t,e){var n=Object.create(er);return n.size=t?t.size:0,n._map=t,n.__ownerID=e,n}function Be(){return nr||(nr=je(Ce()))}function He(t,e){var n,r=function(o){if(o instanceof r)return o;if(!(this instanceof r))return new r(o);if(!n){n=!0;var u=Object.keys(t);Ke(i,u),i.size=u.length,i._name=e,i._keys=u,i._defaultValues=t}this._map=Rt(o)},i=r.prototype=Object.create(rr);return i.constructor=r,r}function Ue(t,e,n){var r=Object.create(Object.getPrototypeOf(t));return r._map=e,r.__ownerID=n,r}function Fe(t){return t._name||t.constructor.name||"Record"}function Ke(t,e){try{e.forEach(We.bind(void 0,t))}catch(n){}}function We(t,e){Object.defineProperty(t,e,{get:function(){return this.get(e)},set:function(t){ut(this.__ownerID,"Cannot set on an immutable record."),this.set(e,t)}})}function Je(t,e){if(t===e)return!0;if(!_(e)||void 0!==t.size&&void 0!==e.size&&t.size!==e.size||void 0!==t.__hash&&void 0!==e.__hash&&t.__hash!==e.__hash||v(t)!==v(e)||y(t)!==y(e)||b(t)!==b(e))return!1;if(0===t.size&&0===e.size)return!0;var n=!g(t);if(b(t)){var r=t.entries();return e.every(function(t,e){var i=r.next().value;return i&&G(i[1],t)&&(n||G(i[0],e))})&&r.next().done}var i=!1;if(void 0===t.size)if(void 0===e.size)"function"==typeof t.cacheResult&&t.cacheResult();else{i=!0;var o=t;t=e,e=o}var u=!0,s=e.__iterate(function(e,r){return(n?t.has(e):i?G(e,t.get(r,ln)):G(t.get(r,ln),e))?void 0:(u=!1,!1)});return u&&t.size===s}function Ve(t,e,n){if(!(this instanceof Ve))return new Ve(t,e,n);if(ut(0!==n,"Cannot step a Range by 0"),t=t||0,void 0===e&&(e=1/0),n=void 0===n?1:Math.abs(n),t>e&&(n=-n),this._start=t,this._end=e,this._step=n,this.size=Math.max(0,Math.ceil((e-t)/n-1)+1),0===this.size){if(ir)return ir;ir=this}}function $e(t,e){if(!(this instanceof $e))return new $e(t,e);if(this._value=t,this.size=void 0===e?1/0:Math.max(0,e),0===this.size){if(or)return or;or=this}}function Ge(t,e){var n=function(n){t.prototype[n]=e[n]};return Object.keys(e).forEach(n),Object.getOwnPropertySymbols&&Object.getOwnPropertySymbols(e).forEach(n),t}function Qe(t,e){return e}function Xe(t,e){return[e,t]}function Ye(t){return function(){return!t.apply(this,arguments)}}function Ze(t){return function(){return-t.apply(this,arguments)}}function tn(t){return"string"==typeof t?JSON.stringify(t):t}function en(){return i(arguments)}function nn(t,e){return e>t?1:t>e?-1:0}function rn(t){if(t.size===1/0)return 0;var e=b(t),n=v(t),r=e?1:0,i=t.__iterate(n?e?function(t,e){r=31*r+un(et(t),et(e))|0}:function(t,e){r=r+un(et(t),et(e))|0}:e?function(t){r=31*r+et(t)|0}:function(t){r=r+et(t)|0});return on(i,r)}function on(t,e){return e=Nn(e,3432918353),e=Nn(e<<15|e>>>-15,461845907),e=Nn(e<<13|e>>>-13,5),e=(e+3864292196|0)^t,e=Nn(e^e>>>16,2246822507),e=Nn(e^e>>>13,3266489909),e=tt(e^e>>>16)}function un(t,e){return t^e+2654435769+(t<<6)+(t>>2)|0}var sn=Array.prototype.slice,an="delete",cn=5,fn=1<<cn,hn=fn-1,ln={},pn={value:!1},dn={value:!1};t(p,l),t(d,l),t(m,l),l.isIterable=_,l.isKeyed=v,l.isIndexed=y,l.isAssociative=g,l.isOrdered=b,l.Keyed=p,l.Indexed=d,l.Set=m;var mn="@@__IMMUTABLE_ITERABLE__@@",_n="@@__IMMUTABLE_KEYED__@@",vn="@@__IMMUTABLE_INDEXED__@@",yn="@@__IMMUTABLE_ORDERED__@@",gn=0,bn=1,wn=2,Sn="function"==typeof Symbol&&Symbol.iterator,En="@@iterator",Mn=Sn||En;w.prototype.toString=function(){return"[Iterator]"},w.KEYS=gn,w.VALUES=bn,w.ENTRIES=wn,w.prototype.inspect=w.prototype.toSource=function(){return this.toString()},w.prototype[Mn]=function(){return this},t(x,l),x.of=function(){return x(arguments)},x.prototype.toSeq=function(){return this},x.prototype.toString=function(){return this.__toString("Seq {","}")},x.prototype.cacheResult=function(){return!this._cache&&this.__iterateUncached&&(this._cache=this.entrySeq().toArray(),this.size=this._cache.length),this},x.prototype.__iterate=function(t,e){return F(this,t,e,!0)},x.prototype.__iterator=function(t,e){return K(this,t,e,!0)},t(k,x),k.prototype.toKeyedSeq=function(){return this},t(z,x),z.of=function(){return z(arguments)},z.prototype.toIndexedSeq=function(){return this},z.prototype.toString=function(){return this.__toString("Seq [","]")},z.prototype.__iterate=function(t,e){return F(this,t,e,!1)},z.prototype.__iterator=function(t,e){return K(this,t,e,!1)},t(L,x),L.of=function(){return L(arguments)},L.prototype.toSetSeq=function(){return this},x.isSeq=R,x.Keyed=k,x.Set=L,x.Indexed=z;var In="@@__IMMUTABLE_SEQ__@@";x.prototype[In]=!0,t(T,z),T.prototype.get=function(t,e){return this.has(t)?this._array[u(this,t)]:e},T.prototype.__iterate=function(t,e){for(var n=this._array,r=n.length-1,i=0;r>=i;i++)if(t(n[e?r-i:i],i,this)===!1)return i+1;return i},T.prototype.__iterator=function(t,e){var n=this._array,r=n.length-1,i=0;return new w(function(){return i>r?E():S(t,i,n[e?r-i++:i++])})},t(A,k),A.prototype.get=function(t,e){return void 0===e||this.has(t)?this._object[t]:e},A.prototype.has=function(t){return this._object.hasOwnProperty(t)},A.prototype.__iterate=function(t,e){for(var n=this._object,r=this._keys,i=r.length-1,o=0;i>=o;o++){var u=r[e?i-o:o];if(t(n[u],u,this)===!1)return o+1}return o},A.prototype.__iterator=function(t,e){var n=this._object,r=this._keys,i=r.length-1,o=0;return new w(function(){var u=r[e?i-o:o];return o++>i?E():S(t,u,n[u])})},A.prototype[yn]=!0,t(D,z),D.prototype.__iterateUncached=function(t,e){if(e)return this.cacheResult().__iterate(t,e);var n=this._iterable,r=C(n),i=0;if(I(r))for(var o;!(o=r.next()).done&&t(o.value,i++,this)!==!1;);return i},D.prototype.__iteratorUncached=function(t,e){if(e)return this.cacheResult().__iterator(t,e);var n=this._iterable,r=C(n);if(!I(r))return new w(E);var i=0;return new w(function(){var e=r.next();return e.done?e:S(t,i++,e.value)})},t(q,z),q.prototype.__iterateUncached=function(t,e){if(e)return this.cacheResult().__iterate(t,e);for(var n=this._iterator,r=this._iteratorCache,i=0;i<r.length;)if(t(r[i],i++,this)===!1)return i;for(var o;!(o=n.next()).done;){var u=o.value;if(r[i]=u,t(u,i++,this)===!1)break}return i},q.prototype.__iteratorUncached=function(t,e){if(e)return this.cacheResult().__iterator(t,e);var n=this._iterator,r=this._iteratorCache,i=0;return new w(function(){if(i>=r.length){var e=n.next();if(e.done)return e;r[i]=e.value}return S(t,i,r[i++])})};var Cn;t(W,l),t(J,W),t(V,W),t($,W),W.Keyed=J,W.Indexed=V,W.Set=$;var On,Nn="function"==typeof Math.imul&&-2===Math.imul(4294967295,2)?Math.imul:function(t,e){t=0|t,e=0|e;var n=65535&t,r=65535&e;return n*r+((t>>>16)*r+n*(e>>>16)<<16>>>0)|0},xn=Object.isExtensible,kn=function(){try{return Object.defineProperty({},"@",{}),!0}catch(t){return!1}}(),zn="function"==typeof WeakMap;zn&&(On=new WeakMap);var Ln=0,Tn="__immutablehash__";"function"==typeof Symbol&&(Tn=Symbol(Tn));var An=16,Dn=255,qn=0,Rn={};t(at,k),at.prototype.get=function(t,e){return this._iter.get(t,e)},at.prototype.has=function(t){return this._iter.has(t)},at.prototype.valueSeq=function(){return this._iter.valueSeq()},at.prototype.reverse=function(){var t=this,e=dt(this,!0);return this._useKeys||(e.valueSeq=function(){return t._iter.toSeq().reverse()}),e},at.prototype.map=function(t,e){var n=this,r=pt(this,t,e);return this._useKeys||(r.valueSeq=function(){return n._iter.toSeq().map(t,e)}),r},at.prototype.__iterate=function(t,e){var n,r=this;return this._iter.__iterate(this._useKeys?function(e,n){return t(e,n,r)}:(n=e?zt(this):0,function(i){return t(i,e?--n:n++,r)}),e)},at.prototype.__iterator=function(t,e){if(this._useKeys)return this._iter.__iterator(t,e);var n=this._iter.__iterator(bn,e),r=e?zt(this):0;return new w(function(){var i=n.next();return i.done?i:S(t,e?--r:r++,i.value,i)})},at.prototype[yn]=!0,t(ct,z),ct.prototype.includes=function(t){return this._iter.includes(t)},ct.prototype.__iterate=function(t,e){var n=this,r=0;return this._iter.__iterate(function(e){return t(e,r++,n)},e)},ct.prototype.__iterator=function(t,e){var n=this._iter.__iterator(bn,e),r=0;return new w(function(){var e=n.next();return e.done?e:S(t,r++,e.value,e)})},t(ft,L),ft.prototype.has=function(t){return this._iter.includes(t)},ft.prototype.__iterate=function(t,e){var n=this;return this._iter.__iterate(function(e){return t(e,e,n)},e)},ft.prototype.__iterator=function(t,e){var n=this._iter.__iterator(bn,e);return new w(function(){var e=n.next();return e.done?e:S(t,e.value,e.value,e)})},t(ht,k),ht.prototype.entrySeq=function(){return this._iter.toSeq()},ht.prototype.__iterate=function(t,e){var n=this;return this._iter.__iterate(function(e){if(e){kt(e);var r=_(e);return t(r?e.get(1):e[1],r?e.get(0):e[0],n)}},e)},ht.prototype.__iterator=function(t,e){var n=this._iter.__iterator(bn,e);return new w(function(){for(;;){var e=n.next();if(e.done)return e;var r=e.value;if(r){kt(r);var i=_(r);return S(t,i?r.get(0):r[0],i?r.get(1):r[1],e)}}})},ct.prototype.cacheResult=at.prototype.cacheResult=ft.prototype.cacheResult=ht.prototype.cacheResult=At,t(Rt,J),Rt.prototype.toString=function(){return this.__toString("Map {","}")},Rt.prototype.get=function(t,e){return this._root?this._root.get(0,void 0,t,e):e},Rt.prototype.set=function(t,e){return Gt(this,t,e)},Rt.prototype.setIn=function(t,e){return this.updateIn(t,ln,function(){return e})},Rt.prototype.remove=function(t){return Gt(this,t,ln)},Rt.prototype.deleteIn=function(t){return this.updateIn(t,function(){return ln})},Rt.prototype.update=function(t,e,n){return 1===arguments.length?t(this):this.updateIn([t],e,n)},Rt.prototype.updateIn=function(t,e,n){n||(n=e,e=void 0);var r=oe(this,qt(t),e,n);return r===ln?void 0:r},Rt.prototype.clear=function(){return 0===this.size?this:this.__ownerID?(this.size=0,this._root=null,this.__hash=void 0,this.__altered=!0,this):$t()},Rt.prototype.merge=function(){return ne(this,void 0,arguments)},Rt.prototype.mergeWith=function(t){var e=sn.call(arguments,1);return ne(this,t,e)},Rt.prototype.mergeIn=function(t){var e=sn.call(arguments,1);return this.updateIn(t,$t(),function(t){return"function"==typeof t.merge?t.merge.apply(t,e):e[e.length-1]})},Rt.prototype.mergeDeep=function(){return ne(this,re(void 0),arguments)},Rt.prototype.mergeDeepWith=function(t){var e=sn.call(arguments,1);return ne(this,re(t),e)},Rt.prototype.mergeDeepIn=function(t){var e=sn.call(arguments,1);return this.updateIn(t,$t(),function(t){return"function"==typeof t.mergeDeep?t.mergeDeep.apply(t,e):e[e.length-1]})},Rt.prototype.sort=function(t){return Ee(It(this,t))},Rt.prototype.sortBy=function(t,e){return Ee(It(this,e,t))},Rt.prototype.withMutations=function(t){var e=this.asMutable();return t(e),e.wasAltered()?e.__ensureOwner(this.__ownerID):this},Rt.prototype.asMutable=function(){return this.__ownerID?this:this.__ensureOwner(new r)},Rt.prototype.asImmutable=function(){return this.__ensureOwner()},Rt.prototype.wasAltered=function(){return this.__altered},Rt.prototype.__iterator=function(t,e){
return new Kt(this,t,e)},Rt.prototype.__iterate=function(t,e){var n=this,r=0;return this._root&&this._root.iterate(function(e){return r++,t(e[1],e[0],n)},e),r},Rt.prototype.__ensureOwner=function(t){return t===this.__ownerID?this:t?Vt(this.size,this._root,t,this.__hash):(this.__ownerID=t,this.__altered=!1,this)},Rt.isMap=Pt;var Pn="@@__IMMUTABLE_MAP__@@",jn=Rt.prototype;jn[Pn]=!0,jn[an]=jn.remove,jn.removeIn=jn.deleteIn,jt.prototype.get=function(t,e,n,r){for(var i=this.entries,o=0,u=i.length;u>o;o++)if(G(n,i[o][0]))return i[o][1];return r},jt.prototype.update=function(t,e,r,o,u,s,a){for(var c=u===ln,f=this.entries,h=0,l=f.length;l>h&&!G(o,f[h][0]);h++);var p=l>h;if(p?f[h][1]===u:c)return this;if(n(a),(c||!p)&&n(s),!c||1!==f.length){if(!p&&!c&&f.length>=Hn)return Zt(t,f,o,u);var d=t&&t===this.ownerID,m=d?f:i(f);return p?c?h===l-1?m.pop():m[h]=m.pop():m[h]=[o,u]:m.push([o,u]),d?(this.entries=m,this):new jt(t,m)}},Bt.prototype.get=function(t,e,n,r){void 0===e&&(e=et(n));var i=1<<((0===t?e:e>>>t)&hn),o=this.bitmap;return 0===(o&i)?r:this.nodes[ue(o&i-1)].get(t+cn,e,n,r)},Bt.prototype.update=function(t,e,n,r,i,o,u){void 0===n&&(n=et(r));var s=(0===e?n:n>>>e)&hn,a=1<<s,c=this.bitmap,f=0!==(c&a);if(!f&&i===ln)return this;var h=ue(c&a-1),l=this.nodes,p=f?l[h]:void 0,d=Qt(p,t,e+cn,n,r,i,o,u);if(d===p)return this;if(!f&&d&&l.length>=Un)return ee(t,l,c,s,d);if(f&&!d&&2===l.length&&Xt(l[1^h]))return l[1^h];if(f&&d&&1===l.length&&Xt(d))return d;var m=t&&t===this.ownerID,_=f?d?c:c^a:c|a,v=f?d?se(l,h,d,m):ce(l,h,m):ae(l,h,d,m);return m?(this.bitmap=_,this.nodes=v,this):new Bt(t,_,v)},Ht.prototype.get=function(t,e,n,r){void 0===e&&(e=et(n));var i=(0===t?e:e>>>t)&hn,o=this.nodes[i];return o?o.get(t+cn,e,n,r):r},Ht.prototype.update=function(t,e,n,r,i,o,u){void 0===n&&(n=et(r));var s=(0===e?n:n>>>e)&hn,a=i===ln,c=this.nodes,f=c[s];if(a&&!f)return this;var h=Qt(f,t,e+cn,n,r,i,o,u);if(h===f)return this;var l=this.count;if(f){if(!h&&(l--,Fn>l))return te(t,c,l,s)}else l++;var p=t&&t===this.ownerID,d=se(c,s,h,p);return p?(this.count=l,this.nodes=d,this):new Ht(t,l,d)},Ut.prototype.get=function(t,e,n,r){for(var i=this.entries,o=0,u=i.length;u>o;o++)if(G(n,i[o][0]))return i[o][1];return r},Ut.prototype.update=function(t,e,r,o,u,s,a){void 0===r&&(r=et(o));var c=u===ln;if(r!==this.keyHash)return c?this:(n(a),n(s),Yt(this,t,e,r,[o,u]));for(var f=this.entries,h=0,l=f.length;l>h&&!G(o,f[h][0]);h++);var p=l>h;if(p?f[h][1]===u:c)return this;if(n(a),(c||!p)&&n(s),c&&2===l)return new Ft(t,this.keyHash,f[1^h]);var d=t&&t===this.ownerID,m=d?f:i(f);return p?c?h===l-1?m.pop():m[h]=m.pop():m[h]=[o,u]:m.push([o,u]),d?(this.entries=m,this):new Ut(t,this.keyHash,m)},Ft.prototype.get=function(t,e,n,r){return G(n,this.entry[0])?this.entry[1]:r},Ft.prototype.update=function(t,e,r,i,o,u,s){var a=o===ln,c=G(i,this.entry[0]);return(c?o===this.entry[1]:a)?this:(n(s),a?void n(u):c?t&&t===this.ownerID?(this.entry[1]=o,this):new Ft(t,this.keyHash,[i,o]):(n(u),Yt(this,t,e,et(i),[i,o])))},jt.prototype.iterate=Ut.prototype.iterate=function(t,e){for(var n=this.entries,r=0,i=n.length-1;i>=r;r++)if(t(n[e?i-r:r])===!1)return!1},Bt.prototype.iterate=Ht.prototype.iterate=function(t,e){for(var n=this.nodes,r=0,i=n.length-1;i>=r;r++){var o=n[e?i-r:r];if(o&&o.iterate(t,e)===!1)return!1}},Ft.prototype.iterate=function(t,e){return t(this.entry)},t(Kt,w),Kt.prototype.next=function(){for(var t=this._type,e=this._stack;e;){var n,r=e.node,i=e.index++;if(r.entry){if(0===i)return Wt(t,r.entry)}else if(r.entries){if(n=r.entries.length-1,n>=i)return Wt(t,r.entries[this._reverse?n-i:i])}else if(n=r.nodes.length-1,n>=i){var o=r.nodes[this._reverse?n-i:i];if(o){if(o.entry)return Wt(t,o.entry);e=this._stack=Jt(o,e)}continue}e=this._stack=this._stack.__prev}return E()};var Bn,Hn=fn/4,Un=fn/2,Fn=fn/4;t(fe,V),fe.of=function(){return this(arguments)},fe.prototype.toString=function(){return this.__toString("List [","]")},fe.prototype.get=function(t,e){if(t=u(this,t),0>t||t>=this.size)return e;t+=this._origin;var n=ge(this,t);return n&&n.array[t&hn]},fe.prototype.set=function(t,e){return _e(this,t,e)},fe.prototype.remove=function(t){return this.has(t)?0===t?this.shift():t===this.size-1?this.pop():this.splice(t,1):this},fe.prototype.clear=function(){return 0===this.size?this:this.__ownerID?(this.size=this._origin=this._capacity=0,this._level=cn,this._root=this._tail=null,this.__hash=void 0,this.__altered=!0,this):me()},fe.prototype.push=function(){var t=arguments,e=this.size;return this.withMutations(function(n){be(n,0,e+t.length);for(var r=0;r<t.length;r++)n.set(e+r,t[r])})},fe.prototype.pop=function(){return be(this,0,-1)},fe.prototype.unshift=function(){var t=arguments;return this.withMutations(function(e){be(e,-t.length);for(var n=0;n<t.length;n++)e.set(n,t[n])})},fe.prototype.shift=function(){return be(this,1)},fe.prototype.merge=function(){return we(this,void 0,arguments)},fe.prototype.mergeWith=function(t){var e=sn.call(arguments,1);return we(this,t,e)},fe.prototype.mergeDeep=function(){return we(this,re(void 0),arguments)},fe.prototype.mergeDeepWith=function(t){var e=sn.call(arguments,1);return we(this,re(t),e)},fe.prototype.setSize=function(t){return be(this,0,t)},fe.prototype.slice=function(t,e){var n=this.size;return a(t,e,n)?this:be(this,c(t,n),f(e,n))},fe.prototype.__iterator=function(t,e){var n=0,r=pe(this,e);return new w(function(){var e=r();return e===Vn?E():S(t,n++,e)})},fe.prototype.__iterate=function(t,e){for(var n,r=0,i=pe(this,e);(n=i())!==Vn&&t(n,r++,this)!==!1;);return r},fe.prototype.__ensureOwner=function(t){return t===this.__ownerID?this:t?de(this._origin,this._capacity,this._level,this._root,this._tail,t,this.__hash):(this.__ownerID=t,this)},fe.isList=he;var Kn="@@__IMMUTABLE_LIST__@@",Wn=fe.prototype;Wn[Kn]=!0,Wn[an]=Wn.remove,Wn.setIn=jn.setIn,Wn.deleteIn=Wn.removeIn=jn.removeIn,Wn.update=jn.update,Wn.updateIn=jn.updateIn,Wn.mergeIn=jn.mergeIn,Wn.mergeDeepIn=jn.mergeDeepIn,Wn.withMutations=jn.withMutations,Wn.asMutable=jn.asMutable,Wn.asImmutable=jn.asImmutable,Wn.wasAltered=jn.wasAltered,le.prototype.removeBefore=function(t,e,n){if(n===e?1<<e:0===this.array.length)return this;var r=n>>>e&hn;if(r>=this.array.length)return new le([],t);var i,o=0===r;if(e>0){var u=this.array[r];if(i=u&&u.removeBefore(t,e-cn,n),i===u&&o)return this}if(o&&!i)return this;var s=ye(this,t);if(!o)for(var a=0;r>a;a++)s.array[a]=void 0;return i&&(s.array[r]=i),s},le.prototype.removeAfter=function(t,e,n){if(n===e?1<<e:0===this.array.length)return this;var r=n-1>>>e&hn;if(r>=this.array.length)return this;var i,o=r===this.array.length-1;if(e>0){var u=this.array[r];if(i=u&&u.removeAfter(t,e-cn,n),i===u&&o)return this}if(o&&!i)return this;var s=ye(this,t);return o||s.array.pop(),i&&(s.array[r]=i),s};var Jn,Vn={};t(Ee,Rt),Ee.of=function(){return this(arguments)},Ee.prototype.toString=function(){return this.__toString("OrderedMap {","}")},Ee.prototype.get=function(t,e){var n=this._map.get(t);return void 0!==n?this._list.get(n)[1]:e},Ee.prototype.clear=function(){return 0===this.size?this:this.__ownerID?(this.size=0,this._map.clear(),this._list.clear(),this):Ce()},Ee.prototype.set=function(t,e){return Oe(this,t,e)},Ee.prototype.remove=function(t){return Oe(this,t,ln)},Ee.prototype.wasAltered=function(){return this._map.wasAltered()||this._list.wasAltered()},Ee.prototype.__iterate=function(t,e){var n=this;return this._list.__iterate(function(e){return e&&t(e[1],e[0],n)},e)},Ee.prototype.__iterator=function(t,e){return this._list.fromEntrySeq().__iterator(t,e)},Ee.prototype.__ensureOwner=function(t){if(t===this.__ownerID)return this;var e=this._map.__ensureOwner(t),n=this._list.__ensureOwner(t);return t?Ie(e,n,t,this.__hash):(this.__ownerID=t,this._map=e,this._list=n,this)},Ee.isOrderedMap=Me,Ee.prototype[yn]=!0,Ee.prototype[an]=Ee.prototype.remove;var $n;t(Ne,V),Ne.of=function(){return this(arguments)},Ne.prototype.toString=function(){return this.__toString("Stack [","]")},Ne.prototype.get=function(t,e){var n=this._head;for(t=u(this,t);n&&t--;)n=n.next;return n?n.value:e},Ne.prototype.peek=function(){return this._head&&this._head.value},Ne.prototype.push=function(){if(0===arguments.length)return this;for(var t=this.size+arguments.length,e=this._head,n=arguments.length-1;n>=0;n--)e={value:arguments[n],next:e};return this.__ownerID?(this.size=t,this._head=e,this.__hash=void 0,this.__altered=!0,this):ke(t,e)},Ne.prototype.pushAll=function(t){if(t=d(t),0===t.size)return this;st(t.size);var e=this.size,n=this._head;return t.reverse().forEach(function(t){e++,n={value:t,next:n}}),this.__ownerID?(this.size=e,this._head=n,this.__hash=void 0,this.__altered=!0,this):ke(e,n)},Ne.prototype.pop=function(){return this.slice(1)},Ne.prototype.unshift=function(){return this.push.apply(this,arguments)},Ne.prototype.unshiftAll=function(t){return this.pushAll(t)},Ne.prototype.shift=function(){return this.pop.apply(this,arguments)},Ne.prototype.clear=function(){return 0===this.size?this:this.__ownerID?(this.size=0,this._head=void 0,this.__hash=void 0,this.__altered=!0,this):ze()},Ne.prototype.slice=function(t,e){if(a(t,e,this.size))return this;var n=c(t,this.size),r=f(e,this.size);if(r!==this.size)return V.prototype.slice.call(this,t,e);for(var i=this.size-n,o=this._head;n--;)o=o.next;return this.__ownerID?(this.size=i,this._head=o,this.__hash=void 0,this.__altered=!0,this):ke(i,o)},Ne.prototype.__ensureOwner=function(t){return t===this.__ownerID?this:t?ke(this.size,this._head,t,this.__hash):(this.__ownerID=t,this.__altered=!1,this)},Ne.prototype.__iterate=function(t,e){if(e)return this.reverse().__iterate(t);for(var n=0,r=this._head;r&&t(r.value,n++,this)!==!1;)r=r.next;return n},Ne.prototype.__iterator=function(t,e){if(e)return this.reverse().__iterator(t);var n=0,r=this._head;return new w(function(){if(r){var e=r.value;return r=r.next,S(t,n++,e)}return E()})},Ne.isStack=xe;var Gn="@@__IMMUTABLE_STACK__@@",Qn=Ne.prototype;Qn[Gn]=!0,Qn.withMutations=jn.withMutations,Qn.asMutable=jn.asMutable,Qn.asImmutable=jn.asImmutable,Qn.wasAltered=jn.wasAltered;var Xn;t(Le,$),Le.of=function(){return this(arguments)},Le.fromKeys=function(t){return this(p(t).keySeq())},Le.prototype.toString=function(){return this.__toString("Set {","}")},Le.prototype.has=function(t){return this._map.has(t)},Le.prototype.add=function(t){return Ae(this,this._map.set(t,!0))},Le.prototype.remove=function(t){return Ae(this,this._map.remove(t))},Le.prototype.clear=function(){return Ae(this,this._map.clear())},Le.prototype.union=function(){var t=sn.call(arguments,0);return t=t.filter(function(t){return 0!==t.size}),0===t.length?this:0!==this.size||this.__ownerID||1!==t.length?this.withMutations(function(e){for(var n=0;n<t.length;n++)m(t[n]).forEach(function(t){return e.add(t)})}):this.constructor(t[0])},Le.prototype.intersect=function(){var t=sn.call(arguments,0);if(0===t.length)return this;t=t.map(function(t){return m(t)});var e=this;return this.withMutations(function(n){e.forEach(function(e){t.every(function(t){return t.includes(e)})||n.remove(e)})})},Le.prototype.subtract=function(){var t=sn.call(arguments,0);if(0===t.length)return this;t=t.map(function(t){return m(t)});var e=this;return this.withMutations(function(n){e.forEach(function(e){t.some(function(t){return t.includes(e)})&&n.remove(e)})})},Le.prototype.merge=function(){return this.union.apply(this,arguments)},Le.prototype.mergeWith=function(t){var e=sn.call(arguments,1);return this.union.apply(this,e)},Le.prototype.sort=function(t){return Re(It(this,t))},Le.prototype.sortBy=function(t,e){return Re(It(this,e,t))},Le.prototype.wasAltered=function(){return this._map.wasAltered()},Le.prototype.__iterate=function(t,e){var n=this;return this._map.__iterate(function(e,r){return t(r,r,n)},e)},Le.prototype.__iterator=function(t,e){return this._map.map(function(t,e){return e}).__iterator(t,e)},Le.prototype.__ensureOwner=function(t){if(t===this.__ownerID)return this;var e=this._map.__ensureOwner(t);return t?this.__make(e,t):(this.__ownerID=t,this._map=e,this)},Le.isSet=Te;var Yn="@@__IMMUTABLE_SET__@@",Zn=Le.prototype;Zn[Yn]=!0,Zn[an]=Zn.remove,Zn.mergeDeep=Zn.merge,Zn.mergeDeepWith=Zn.mergeWith,Zn.withMutations=jn.withMutations,Zn.asMutable=jn.asMutable,Zn.asImmutable=jn.asImmutable,Zn.__empty=qe,Zn.__make=De;var tr;t(Re,Le),Re.of=function(){return this(arguments)},Re.fromKeys=function(t){return this(p(t).keySeq())},Re.prototype.toString=function(){return this.__toString("OrderedSet {","}")},Re.isOrderedSet=Pe;var er=Re.prototype;er[yn]=!0,er.__empty=Be,er.__make=je;var nr;t(He,J),He.prototype.toString=function(){return this.__toString(Fe(this)+" {","}")},He.prototype.has=function(t){return this._defaultValues.hasOwnProperty(t)},He.prototype.get=function(t,e){if(!this.has(t))return e;var n=this._defaultValues[t];return this._map?this._map.get(t,n):n},He.prototype.clear=function(){if(this.__ownerID)return this._map&&this._map.clear(),this;var t=this.constructor;return t._empty||(t._empty=Ue(this,$t()))},He.prototype.set=function(t,e){if(!this.has(t))throw new Error('Cannot set unknown key "'+t+'" on '+Fe(this));var n=this._map&&this._map.set(t,e);return this.__ownerID||n===this._map?this:Ue(this,n)},He.prototype.remove=function(t){if(!this.has(t))return this;var e=this._map&&this._map.remove(t);return this.__ownerID||e===this._map?this:Ue(this,e)},He.prototype.wasAltered=function(){return this._map.wasAltered()},He.prototype.__iterator=function(t,e){var n=this;return p(this._defaultValues).map(function(t,e){return n.get(e)}).__iterator(t,e)},He.prototype.__iterate=function(t,e){var n=this;return p(this._defaultValues).map(function(t,e){return n.get(e)}).__iterate(t,e)},He.prototype.__ensureOwner=function(t){if(t===this.__ownerID)return this;var e=this._map&&this._map.__ensureOwner(t);return t?Ue(this,e,t):(this.__ownerID=t,this._map=e,this)};var rr=He.prototype;rr[an]=rr.remove,rr.deleteIn=rr.removeIn=jn.removeIn,rr.merge=jn.merge,rr.mergeWith=jn.mergeWith,rr.mergeIn=jn.mergeIn,rr.mergeDeep=jn.mergeDeep,rr.mergeDeepWith=jn.mergeDeepWith,rr.mergeDeepIn=jn.mergeDeepIn,rr.setIn=jn.setIn,rr.update=jn.update,rr.updateIn=jn.updateIn,rr.withMutations=jn.withMutations,rr.asMutable=jn.asMutable,rr.asImmutable=jn.asImmutable,t(Ve,z),Ve.prototype.toString=function(){return 0===this.size?"Range []":"Range [ "+this._start+"..."+this._end+(this._step>1?" by "+this._step:"")+" ]"},Ve.prototype.get=function(t,e){return this.has(t)?this._start+u(this,t)*this._step:e},Ve.prototype.includes=function(t){var e=(t-this._start)/this._step;return e>=0&&e<this.size&&e===Math.floor(e)},Ve.prototype.slice=function(t,e){return a(t,e,this.size)?this:(t=c(t,this.size),e=f(e,this.size),t>=e?new Ve(0,0):new Ve(this.get(t,this._end),this.get(e,this._end),this._step))},Ve.prototype.indexOf=function(t){var e=t-this._start;if(e%this._step===0){var n=e/this._step;if(n>=0&&n<this.size)return n}return-1},Ve.prototype.lastIndexOf=function(t){return this.indexOf(t)},Ve.prototype.__iterate=function(t,e){for(var n=this.size-1,r=this._step,i=e?this._start+n*r:this._start,o=0;n>=o;o++){if(t(i,o,this)===!1)return o+1;i+=e?-r:r}return o},Ve.prototype.__iterator=function(t,e){var n=this.size-1,r=this._step,i=e?this._start+n*r:this._start,o=0;return new w(function(){var u=i;return i+=e?-r:r,o>n?E():S(t,o++,u)})},Ve.prototype.equals=function(t){return t instanceof Ve?this._start===t._start&&this._end===t._end&&this._step===t._step:Je(this,t)};var ir;t($e,z),$e.prototype.toString=function(){return 0===this.size?"Repeat []":"Repeat [ "+this._value+" "+this.size+" times ]"},$e.prototype.get=function(t,e){return this.has(t)?this._value:e},$e.prototype.includes=function(t){return G(this._value,t)},$e.prototype.slice=function(t,e){var n=this.size;return a(t,e,n)?this:new $e(this._value,f(e,n)-c(t,n))},$e.prototype.reverse=function(){return this},$e.prototype.indexOf=function(t){return G(this._value,t)?0:-1},$e.prototype.lastIndexOf=function(t){return G(this._value,t)?this.size:-1},$e.prototype.__iterate=function(t,e){for(var n=0;n<this.size;n++)if(t(this._value,n,this)===!1)return n+1;return n},$e.prototype.__iterator=function(t,e){var n=this,r=0;return new w(function(){return r<n.size?S(t,r++,n._value):E()})},$e.prototype.equals=function(t){return t instanceof $e?G(this._value,t._value):Je(t)};var or;l.Iterator=w,Ge(l,{toArray:function(){st(this.size);var t=new Array(this.size||0);return this.valueSeq().__iterate(function(e,n){t[n]=e}),t},toIndexedSeq:function(){return new ct(this)},toJS:function(){return this.toSeq().map(function(t){return t&&"function"==typeof t.toJS?t.toJS():t}).__toJS()},toJSON:function(){return this.toSeq().map(function(t){return t&&"function"==typeof t.toJSON?t.toJSON():t}).__toJS()},toKeyedSeq:function(){return new at(this,!0)},toMap:function(){return Rt(this.toKeyedSeq())},toObject:function(){st(this.size);var t={};return this.__iterate(function(e,n){t[n]=e}),t},toOrderedMap:function(){return Ee(this.toKeyedSeq())},toOrderedSet:function(){return Re(v(this)?this.valueSeq():this)},toSet:function(){return Le(v(this)?this.valueSeq():this)},toSetSeq:function(){return new ft(this)},toSeq:function(){return y(this)?this.toIndexedSeq():v(this)?this.toKeyedSeq():this.toSetSeq()},toStack:function(){return Ne(v(this)?this.valueSeq():this)},toList:function(){return fe(v(this)?this.valueSeq():this)},toString:function(){return"[Iterable]"},__toString:function(t,e){return 0===this.size?t+e:t+" "+this.toSeq().map(this.__toStringMapper).join(", ")+" "+e},concat:function(){var t=sn.call(arguments,0);return xt(this,wt(this,t))},contains:function(t){return this.includes(t)},includes:function(t){return this.some(function(e){return G(e,t)})},entries:function(){return this.__iterator(wn)},every:function(t,e){st(this.size);var n=!0;return this.__iterate(function(r,i,o){return t.call(e,r,i,o)?void 0:(n=!1,!1)}),n},filter:function(t,e){return xt(this,mt(this,t,e,!0))},find:function(t,e,n){var r=this.findEntry(t,e);return r?r[1]:n},findEntry:function(t,e){var n;return this.__iterate(function(r,i,o){return t.call(e,r,i,o)?(n=[i,r],!1):void 0}),n},findLastEntry:function(t,e){return this.toSeq().reverse().findEntry(t,e)},forEach:function(t,e){return st(this.size),this.__iterate(e?t.bind(e):t)},join:function(t){st(this.size),t=void 0!==t?""+t:",";var e="",n=!0;return this.__iterate(function(r){n?n=!1:e+=t,e+=null!==r&&void 0!==r?r.toString():""}),e},keys:function(){return this.__iterator(gn)},map:function(t,e){return xt(this,pt(this,t,e))},reduce:function(t,e,n){st(this.size);var r,i;return arguments.length<2?i=!0:r=e,this.__iterate(function(e,o,u){i?(i=!1,r=e):r=t.call(n,r,e,o,u)}),r},reduceRight:function(t,e,n){var r=this.toKeyedSeq().reverse();return r.reduce.apply(r,arguments)},reverse:function(){return xt(this,dt(this,!0))},slice:function(t,e){return xt(this,yt(this,t,e,!0))},some:function(t,e){return!this.every(Ye(t),e)},sort:function(t){return xt(this,It(this,t))},values:function(){return this.__iterator(bn)},butLast:function(){return this.slice(0,-1)},isEmpty:function(){return void 0!==this.size?0===this.size:!this.some(function(){return!0})},count:function(t,e){return o(t?this.toSeq().filter(t,e):this)},countBy:function(t,e){return _t(this,t,e)},equals:function(t){return Je(this,t)},entrySeq:function(){var t=this;if(t._cache)return new T(t._cache);var e=t.toSeq().map(Xe).toIndexedSeq();return e.fromEntrySeq=function(){return t.toSeq()},e},filterNot:function(t,e){return this.filter(Ye(t),e)},findLast:function(t,e,n){return this.toKeyedSeq().reverse().find(t,e,n)},first:function(){return this.find(s)},flatMap:function(t,e){return xt(this,Et(this,t,e))},flatten:function(t){return xt(this,St(this,t,!0))},fromEntrySeq:function(){return new ht(this)},get:function(t,e){return this.find(function(e,n){return G(n,t)},void 0,e)},getIn:function(t,e){for(var n,r=this,i=qt(t);!(n=i.next()).done;){var o=n.value;if(r=r&&r.get?r.get(o,ln):ln,r===ln)return e}return r},groupBy:function(t,e){return vt(this,t,e)},has:function(t){return this.get(t,ln)!==ln},hasIn:function(t){return this.getIn(t,ln)!==ln},isSubset:function(t){return t="function"==typeof t.includes?t:l(t),this.every(function(e){return t.includes(e)})},isSuperset:function(t){return t.isSubset(this)},keySeq:function(){return this.toSeq().map(Qe).toIndexedSeq()},last:function(){return this.toSeq().reverse().first()},max:function(t){return Ct(this,t)},maxBy:function(t,e){return Ct(this,e,t)},min:function(t){return Ct(this,t?Ze(t):nn)},minBy:function(t,e){return Ct(this,e?Ze(e):nn,t)},rest:function(){return this.slice(1)},skip:function(t){return this.slice(Math.max(0,t))},skipLast:function(t){return xt(this,this.toSeq().reverse().skip(t).reverse())},skipWhile:function(t,e){return xt(this,bt(this,t,e,!0))},skipUntil:function(t,e){return this.skipWhile(Ye(t),e)},sortBy:function(t,e){return xt(this,It(this,e,t))},take:function(t){return this.slice(0,Math.max(0,t))},takeLast:function(t){return xt(this,this.toSeq().reverse().take(t).reverse())},takeWhile:function(t,e){return xt(this,gt(this,t,e))},takeUntil:function(t,e){return this.takeWhile(Ye(t),e)},valueSeq:function(){return this.toIndexedSeq()},hashCode:function(){return this.__hash||(this.__hash=rn(this))}});var ur=l.prototype;ur[mn]=!0,ur[Mn]=ur.values,ur.__toJS=ur.toArray,ur.__toStringMapper=tn,ur.inspect=ur.toSource=function(){return this.toString()},ur.chain=ur.flatMap,function(){try{Object.defineProperty(ur,"length",{get:function(){if(!l.noLengthWarning){var t;try{throw new Error}catch(e){t=e.stack}if(-1===t.indexOf("_wrapObject"))return console&&console.warn&&console.warn("iterable.length has been deprecated, use iterable.size or iterable.count(). This warning will become a silent error in a future version. "+t),this.size}}})}catch(t){}}(),Ge(p,{flip:function(){return xt(this,lt(this))},findKey:function(t,e){var n=this.findEntry(t,e);return n&&n[0]},findLastKey:function(t,e){return this.toSeq().reverse().findKey(t,e)},keyOf:function(t){return this.findKey(function(e){return G(e,t)})},lastKeyOf:function(t){return this.findLastKey(function(e){return G(e,t)})},mapEntries:function(t,e){var n=this,r=0;return xt(this,this.toSeq().map(function(i,o){return t.call(e,[o,i],r++,n)}).fromEntrySeq())},mapKeys:function(t,e){var n=this;return xt(this,this.toSeq().flip().map(function(r,i){return t.call(e,r,i,n)}).flip())}});var sr=p.prototype;sr[_n]=!0,sr[Mn]=ur.entries,sr.__toJS=ur.toObject,sr.__toStringMapper=function(t,e){return JSON.stringify(e)+": "+tn(t)},Ge(d,{toKeyedSeq:function(){return new at(this,!1)},filter:function(t,e){return xt(this,mt(this,t,e,!1))},findIndex:function(t,e){var n=this.findEntry(t,e);return n?n[0]:-1},indexOf:function(t){var e=this.toKeyedSeq().keyOf(t);return void 0===e?-1:e},lastIndexOf:function(t){return this.toSeq().reverse().indexOf(t)},reverse:function(){return xt(this,dt(this,!1))},slice:function(t,e){return xt(this,yt(this,t,e,!1))},splice:function(t,e){var n=arguments.length;if(e=Math.max(0|e,0),0===n||2===n&&!e)return this;t=c(t,this.size);var r=this.slice(0,t);return xt(this,1===n?r:r.concat(i(arguments,2),this.slice(t+e)))},findLastIndex:function(t,e){var n=this.toKeyedSeq().findLastKey(t,e);return void 0===n?-1:n},first:function(){return this.get(0)},flatten:function(t){return xt(this,St(this,t,!1))},get:function(t,e){return t=u(this,t),0>t||this.size===1/0||void 0!==this.size&&t>this.size?e:this.find(function(e,n){return n===t},void 0,e)},has:function(t){return t=u(this,t),t>=0&&(void 0!==this.size?this.size===1/0||t<this.size:-1!==this.indexOf(t))},interpose:function(t){return xt(this,Mt(this,t))},interleave:function(){var t=[this].concat(i(arguments)),e=Nt(this.toSeq(),z.of,t),n=e.flatten(!0);return e.size&&(n.size=e.size*t.length),xt(this,n)},last:function(){return this.get(-1)},skipWhile:function(t,e){return xt(this,bt(this,t,e,!1))},zip:function(){var t=[this].concat(i(arguments));return xt(this,Nt(this,en,t))},zipWith:function(t){var e=i(arguments);return e[0]=this,xt(this,Nt(this,t,e))}}),d.prototype[vn]=!0,d.prototype[yn]=!0,Ge(m,{get:function(t,e){return this.has(t)?t:e},includes:function(t){return this.has(t)},keySeq:function(){return this.valueSeq()}}),m.prototype.has=ur.includes,Ge(k,p.prototype),Ge(z,d.prototype),Ge(L,m.prototype),Ge(J,p.prototype),Ge(V,d.prototype),Ge($,m.prototype);var ar={Iterable:l,Seq:x,Collection:W,Map:Rt,OrderedMap:Ee,List:fe,Stack:Ne,Set:Le,OrderedSet:Re,Record:He,Range:Ve,Repeat:$e,is:G,fromJS:Q};return ar}),define("plugins/core/formatters/html/enforce-p-elements",["immutable"],function(t){"use strict";return function(){return function(e){function n(e){var n=0;t.List(e.childNodes).filterNot(function(t){return i.isWhitespaceOnlyTextNode(Node,t)}).filter(function(t){return t.nodeType===Node.TEXT_NODE||!i.isBlockElement(t)}).groupBy(function(t,e,r){return 0===e||t.previousSibling===r.get(e-1)?n:n+=1}).forEach(function(t){i.wrap(t.toArray(),document.createElement("p"))})}function r(t){for(var e,r=0;e=t.children[r++];)"BLOCKQUOTE"===e.tagName&&n(e)}var i=e.node;e.registerHTMLFormatter("normalize",function(t){var e=document.createElement("div");return e.innerHTML=t,n(e),r(e),e.innerHTML})}}}),define("constants/inline-element-names",["immutable"],function(t){var e=t.Set.of("B","BIG","I","SMALL","TT","ABBR","ACRONYM","CITE","CODE","DFN","EM","KBD","STRONG","SAMP","VAR","A","BDO","BR","IMG","MAP","OBJECT","Q","SCRIPT","SPAN","SUB","SUP","BUTTON","INPUT","LABEL","SELECT","TEXTAREA");return e}),define("constants/block-element-names",["immutable"],function(t){var e=t.Set.of("ADDRESS","ARTICLE","ASIDE","AUDIO","BLOCKQUOTE","CANVAS","DD","DIV","FIELDSET","FIGCAPTION","FIGURE","FOOTER","FORM","H1","H2","H3","H4","H5","H6","HEADER","HGROUP","HR","LI","NOSCRIPT","OL","OUTPUT","P","PRE","SECTION","TABLE","TD","TH","TFOOT","UL","VIDEO");return e}),define("node",["./constants/inline-element-names","./constants/block-element-names","immutable"],function(t,e,n){"use strict";function r(t){return e.includes(t.nodeName)}function i(e){return t.includes(e.nodeName)}function o(t){return t.children.length>1?!1:1===t.children.length&&""!==t.textContent.trim()?!1:0===t.children.length?""===t.textContent.trim():o(t.children[0])}function u(t){return t.nodeType===Node.TEXT_NODE}function s(t){return u(t)&&""===t.data}function a(t){return t.nodeType===Node.DOCUMENT_FRAGMENT_NODE}function c(t,e){return t.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING}function f(t,e){return function(n){return n.nodeType===t.ELEMENT_NODE&&n.className===e}}function h(t){return f(Node,"scribe-marker")(t)}function l(t){return f(Node,"caret-position")(t)}function p(t,e){return e.nodeType===t.TEXT_NODE&&/^\s*$/.test(e.nodeValue)?!0:!1}function d(t){var e=t.firstChild;return e&&"BR"!==e.nodeName?d(e):t}function m(t,e){return e.parentNode.insertBefore(t,e.nextSibling)}function _(t){return t.parentNode.removeChild(t)}function v(t,e,n){function r(t){return e===t}if(!r(t))for(var i=t.parentNode;i&&!r(i);){if(n(i))return i;i=i.parentNode}}function y(t){for(var e=n.List();t=t.nextSibling;)e=e.push(t);return e}function g(t,e){return t[0].parentNode.insertBefore(e,t[0]),t.forEach(function(t){e.appendChild(t)}),e}function b(t,e){for(;e.childNodes.length>0;)t.insertBefore(e.childNodes[0],e);t.removeChild(e)}function w(e){function r(t,e){return window.getComputedStyle(e).lineHeight===t.lineHeight}var i=n.List(e.querySelectorAll(t.map(function(t){return t+'[style*="line-height"]'}).join(",")));i=i.filter(r.bind(null,window.getComputedStyle(e)));var o=n.List();i.forEach(function(t){t.style.lineHeight=null,t.getAttribute("style")||t.removeAttribute("style"),"SPAN"===t.nodeName&&0===t.attributes.length&&(o=o.push(t))}),o.forEach(function(t){b(t.parentNode,t)})}return{isInlineElement:i,isBlockElement:r,isEmptyInlineElement:o,isText:u,isEmptyTextNode:s,isWhitespaceOnlyTextNode:p,isFragment:a,isBefore:c,isSelectionMarkerNode:h,isCaretPositionNode:l,firstDeepestChild:d,insertAfter:m,removeNode:_,getAncestor:v,nextSiblings:y,wrap:g,unwrap:b,removeChromeArtifacts:w,elementHasClass:f}}),define("plugins/core/formatters/html/ensure-selectable-containers",["../../../../node","immutable"],function(t,e){"use strict";function n(e){return t.isCaretPositionNode(e)?!0:""===e.parentNode.textContent.trim()}function r(e){function o(e){return 0===e.children.length&&t.isBlockElement(e)||1===e.children.length&&t.isSelectionMarkerNode(e.children[0])?!0:t.isBlockElement(e)||0!==e.children.length?!1:n(e)}for(var u=e.firstElementChild;u;)t.isSelectionMarkerNode(u)||(o(u)&&""===u.textContent.trim()&&!i.includes(u.nodeName)?u.appendChild(document.createElement("br")):u.children.length>0&&r(u)),u=u.nextElementSibling}var i=e.Set.of("AREA","BASE","BR","COL","COMMAND","EMBED","HR","IMG","INPUT","KEYGEN","LINK","META","PARAM","SOURCE","TRACK","WBR");return function(){return function(t){t.registerHTMLFormatter("normalize",function(t){var e=document.createElement("div");return e.innerHTML=t,r(e),e.innerHTML})}}}),define("plugins/core/inline-elements-mode",[],function(){"use strict";function t(t){for(var e=document.createTreeWalker(t,NodeFilter.SHOW_ALL,null,!1);e.nextNode();)if(e.currentNode&&(~["br"].indexOf(e.currentNode.nodeName.toLowerCase())||e.currentNode.length>0))return!0;return!1}return function(){return function(e){e.el.addEventListener("keydown",function(n){if(13===n.keyCode){var r=new e.api.Selection,i=r.range,o=r.getContaining(function(t){return"LI"===t.nodeName||/^(H[1-6])$/.test(t.nodeName)});o||(n.preventDefault(),e.transactionManager.run(function(){"BR"===e.el.lastChild.nodeName&&e.el.removeChild(e.el.lastChild);var n=document.createElement("br");i.insertNode(n),i.collapse(!1);var o=i.cloneRange();o.setEndAfter(e.el.lastChild,0);var u=o.cloneContents();if(!t(u)){var s=document.createElement("br");i.insertNode(s)}var a=i.cloneRange();a.setStartAfter(n,0),a.setEndAfter(n,0),r.selection.removeAllRanges(),r.selection.addRange(a)}))}}.bind(this)),""===e.getHTML().trim()&&e.setContent("")}}}),define("plugins/core/plugins",["./set-root-p-element","./formatters/html/enforce-p-elements","./formatters/html/ensure-selectable-containers","./inline-elements-mode"],function(t,e,n,r){"use strict";return{setRootPElement:t,enforcePElements:e,ensureSelectableContainers:n,inlineElementsMode:r}}),define("plugins/core/commands/indent",[],function(){"use strict";return function(){return function(t){var e=new t.api.Command("indent");e.queryEnabled=function(){var e=new t.api.Selection,n=e.getContaining(function(t){return"UL"===t.nodeName||"OL"===t.nodeName});return t.api.Command.prototype.queryEnabled.call(this)&&t.allowsBlockElements()&&!n},t.commands.indent=e}}}),define("plugins/core/commands/insert-list",["immutable"],function(t){"use strict";return function(){return function(e){var n=e.node,r=function(t){e.api.Command.call(this,t)};r.prototype=Object.create(e.api.Command.prototype),r.prototype.constructor=r,r.prototype.execute=function(r){function i(t){if(t.size){for(var e=document.createElement(s.nodeName);t.size;)e.appendChild(t.first()),t=t.shift();s.parentNode.insertBefore(e,s.nextElementSibling)}}if(this.queryState()){var o=new e.api.Selection,u=o.range,s=o.getContaining(function(t){return"OL"===t.nodeName||"UL"===t.nodeName}),a=o.getContaining(function(t){return"LI"===t.nodeName});e.transactionManager.run(function(){if(a){var e=n.nextSiblings(a);i(e),o.placeMarkers();var r=document.createElement("p");r.innerHTML=a.innerHTML,s.parentNode.insertBefore(r,s.nextElementSibling),a.parentNode.removeChild(a)}else{var c=t.List(s.querySelectorAll("li")).filter(function(t){return u.intersectsNode(t)}),f=c.last(),h=n.nextSiblings(f);i(h),o.placeMarkers();var l=document.createDocumentFragment();c.forEach(function(t){var e=document.createElement("p");e.innerHTML=t.innerHTML,l.appendChild(e)}),s.parentNode.insertBefore(l,s.nextElementSibling),c.forEach(function(t){t.parentNode.removeChild(t)})}0===s.childNodes.length&&s.parentNode.removeChild(s),o.selectMarkers()}.bind(this))}else e.api.Command.prototype.execute.call(this,r)},r.prototype.queryEnabled=function(){return e.api.Command.prototype.queryEnabled.call(this)&&e.allowsBlockElements();
},e.commands.insertOrderedList=new r("insertOrderedList"),e.commands.insertUnorderedList=new r("insertUnorderedList")}}}),define("plugins/core/commands/outdent",[],function(){"use strict";return function(){return function(t){var e=new t.api.Command("outdent");e.queryEnabled=function(){var e=new t.api.Selection,n=e.getContaining(function(t){return"UL"===t.nodeName||"OL"===t.nodeName});return t.api.Command.prototype.queryEnabled.call(this)&&t.allowsBlockElements()&&!n},t.commands.outdent=e}}}),define("plugins/core/commands/redo",[],function(){"use strict";return function(){return function(t){var e=new t.api.Command("redo");e.execute=function(){t.undoManager.redo()},e.queryEnabled=function(){return t.undoManager.position>0},t.commands.redo=e,t.options.undo.enabled&&t.el.addEventListener("keydown",function(t){t.shiftKey&&(t.metaKey||t.ctrlKey)&&90===t.keyCode&&(t.preventDefault(),e.execute())})}}}),define("plugins/core/commands/subscript",[],function(){"use strict";return function(){return function(t){var e=new t.api.Command("subscript");t.commands.subscript=e}}}),define("plugins/core/commands/superscript",[],function(){"use strict";return function(){return function(t){var e=new t.api.Command("superscript");t.commands.superscript=e}}}),define("plugins/core/commands/undo",[],function(){"use strict";return function(){return function(t){var e=new t.api.Command("undo");e.execute=function(){t.undoManager.undo()},e.queryEnabled=function(){return t.undoManager.position<t.undoManager.length},t.commands.undo=e,t.options.undo.enabled&&t.el.addEventListener("keydown",function(t){t.shiftKey||!t.metaKey&&!t.ctrlKey||90!==t.keyCode||(t.preventDefault(),e.execute())})}}}),define("plugins/core/commands",["./commands/indent","./commands/insert-list","./commands/outdent","./commands/redo","./commands/subscript","./commands/superscript","./commands/undo"],function(t,e,n,r,i,o,u){"use strict";return{indent:t,insertList:e,outdent:n,redo:r,subscript:i,superscript:o,undo:u}}),define("plugins/core/formatters/html/replace-nbsp-chars",[],function(){"use strict";return function(){return function(t){var e=/(\s|&nbsp;)+/g;t.registerHTMLFormatter("export",function(t){return t.replace(e," ")})}}}),define("lodash-amd/modern/internal/baseToString",[],function(){function t(t){return"string"==typeof t?t:null==t?"":t+""}return t}),define("lodash-amd/modern/internal/escapeHtmlChar",[],function(){function t(t){return e[t]}var e={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","`":"&#96;"};return t}),define("lodash-amd/modern/string/escape",["../internal/baseToString","../internal/escapeHtmlChar"],function(t,e){function n(n){return n=t(n),n&&i.test(n)?n.replace(r,e):n}var r=/[&<>"'`]/g,i=RegExp(r.source);return n}),define("plugins/core/formatters/plain-text/escape-html-characters",["lodash-amd/modern/string/escape"],function(t){"use strict";return function(){return function(e){e.registerPlainTextFormatter(t)}}}),define("plugins/core/formatters",["./formatters/html/replace-nbsp-chars","./formatters/plain-text/escape-html-characters"],function(t,e){"use strict";return{replaceNbspCharsFormatter:t,escapeHtmlCharactersFormatter:e}}),define("mutations",[],function(){function t(t){return"undefined"==typeof t?function(){return{observe:function(){}}}:t.MutationObserver||t.WebKitMutationObserver||t.MozMutationObserver}return{determineMutationObserver:t}}),define("dom-observer",["./node","./mutations"],function(t,e){function n(e){return!t.isEmptyTextNode(e)&&!t.isSelectionMarkerNode(e)}function r(t){return t.some(function(t){return Array.prototype.some.call(t.addedNodes,n)||Array.prototype.some.call(t.removedNodes,n)})}function i(t,e){var n=!1,i=new u(function(t){if(!n&&r(t)){n=!0;try{e()}catch(i){throw i}finally{setTimeout(function(){n=!1},0)}}});return i.observe(t,{childList:!0,subtree:!0}),i}var o="object"==typeof window?window:void 0,u=e.determineMutationObserver(o);return i}),define("plugins/core/events",["../../dom-observer","immutable"],function(t,e){"use strict";return function(){return function(n){var r=n.node;n.el.addEventListener("focus",function(){var t=new n.api.Selection;if(t.range){var e=n.allowsBlockElements()&&t.range.startContainer===n.el;if(e){var i=r.firstDeepestChild(n.el),o=t.range;o.setStart(i,0),o.setEnd(i,0),t.selection.removeAllRanges(),t.selection.addRange(o)}}}.bind(n));var i=function(){if(!n._skipFormatters){var t=new n.api.Selection,e=t.range,r=function(){e&&t.placeMarkers(),n.setHTML(n._htmlFormatterFactory.format(n.getHTML())),t.selectMarkers()}.bind(n);n.transactionManager.run(r)}delete n._skipFormatters}.bind(n);t(n.el,i),n.allowsBlockElements()&&n.el.addEventListener("keydown",function(t){if(13===t.keyCode){var e=new n.api.Selection,r=e.range,i=e.getContaining(function(t){return/^(H[1-6])$/.test(t.nodeName)});if(i&&r.collapsed){var o=r.cloneRange();o.setEndAfter(i,0);var u=o.cloneContents();""===u.firstChild.textContent&&(t.preventDefault(),n.transactionManager.run(function(){var t=document.createElement("p"),n=document.createElement("br");t.appendChild(n),i.parentNode.insertBefore(t,i.nextElementSibling),r.setStart(t,0),r.setEnd(t,0),e.selection.removeAllRanges(),e.selection.addRange(r)}))}}}),n.allowsBlockElements()&&n.el.addEventListener("keydown",function(t){if(13===t.keyCode||8===t.keyCode){var e=new n.api.Selection,r=e.range;if(r.collapsed){var i=e.getContaining(function(t){return"LI"===t.nodeName});if(i&&""===i.textContent.trim()){t.preventDefault();var o=e.getContaining(function(t){return"UL"===t.nodeName||"OL"===t.nodeName}),u=n.getCommand("OL"===o.nodeName?"insertOrderedList":"insertUnorderedList");u.event=t,u.execute()}}}}),n.el.addEventListener("paste",function(t){if(t.clipboardData&&t.clipboardData.types.length>0)t.preventDefault(),e.List(t.clipboardData.types).includes("text/html")?n.insertHTML(t.clipboardData.getData("text/html")):n.insertPlainText(t.clipboardData.getData("text/plain"));else{var r=new n.api.Selection;r.placeMarkers();var i=document.createElement("div");document.body.appendChild(i),i.setAttribute("contenteditable",!0),i.focus(),setTimeout(function(){var t=i.innerHTML;i.parentNode.removeChild(i),r.selectMarkers(),n.el.focus(),n.insertHTML(t)},1)}})}}}),define("plugins/core/patches/commands/bold",[],function(){"use strict";return function(){return function(t){var e=new t.api.CommandPatch("bold");e.queryEnabled=function(){var e=new t.api.Selection,n=e.getContaining(function(t){return/^(H[1-6])$/.test(t.nodeName)});return t.api.CommandPatch.prototype.queryEnabled.apply(this,arguments)&&!n},t.commandPatches.bold=e}}}),define("plugins/core/patches/commands/indent",[],function(){"use strict";var t="\ufeff";return function(){return function(e){var n=new e.api.CommandPatch("indent");n.execute=function(n){e.transactionManager.run(function(){var r=new e.api.Selection,i=r.range,o="P"===i.commonAncestorContainer.nodeName&&"<br>"===i.commonAncestorContainer.innerHTML;if(o){var u=document.createTextNode(t);i.insertNode(u),i.setStart(u,0),i.setEnd(u,0),r.selection.removeAllRanges(),r.selection.addRange(i)}e.api.CommandPatch.prototype.execute.call(this,n),r=new e.api.Selection;var s=r.getContaining(function(t){return"BLOCKQUOTE"===t.nodeName});s&&s.removeAttribute("style")}.bind(this))},e.commandPatches.indent=n}}}),define("plugins/core/patches/commands/insert-html",[],function(){"use strict";return function(){return function(t){var e=new t.api.CommandPatch("insertHTML"),n=t.node;e.execute=function(e){t.transactionManager.run(function(){t.api.CommandPatch.prototype.execute.call(this,e),n.removeChromeArtifacts(t.el)}.bind(this))},t.commandPatches.insertHTML=e}}}),define("plugins/core/patches/commands/insert-list",[],function(){"use strict";return function(){return function(t){var e=t.node,n=function(e){t.api.CommandPatch.call(this,e)};n.prototype=Object.create(t.api.CommandPatch.prototype),n.prototype.constructor=n,n.prototype.execute=function(n){t.transactionManager.run(function(){if(t.api.CommandPatch.prototype.execute.call(this,n),this.queryState()){var r=new t.api.Selection,i=r.getContaining(function(t){return"OL"===t.nodeName||"UL"===t.nodeName});if(i.nextElementSibling&&0===i.nextElementSibling.childNodes.length&&e.removeNode(i.nextElementSibling),i){var o=i.parentNode;o&&/^(H[1-6]|P)$/.test(o.nodeName)&&(r.placeMarkers(),e.insertAfter(i,o),r.selectMarkers(),2===o.childNodes.length&&e.isEmptyTextNode(o.firstChild)&&e.removeNode(o),0===o.childNodes.length&&e.removeNode(o))}e.removeChromeArtifacts(i)}}.bind(this))},n.prototype.queryState=function(){try{return t.api.CommandPatch.prototype.queryState.apply(this,arguments)}catch(e){if("NS_ERROR_UNEXPECTED"==e.name)return!1;throw e}},t.commandPatches.insertOrderedList=new n("insertOrderedList"),t.commandPatches.insertUnorderedList=new n("insertUnorderedList")}}}),define("plugins/core/patches/commands/outdent",[],function(){"use strict";return function(){return function(t){var e=t.node,n=new t.api.CommandPatch("outdent");n.execute=function(){t.transactionManager.run(function(){var n=new t.api.Selection,r=n.range,i=n.getContaining(function(t){return"BLOCKQUOTE"===t.nodeName});if("BLOCKQUOTE"===r.commonAncestorContainer.nodeName){n.placeMarkers(),n.selectMarkers(!0);var o=r.cloneContents();i.parentNode.insertBefore(o,i),r.deleteContents(),n.selectMarkers(),""===i.textContent&&i.parentNode.removeChild(i)}else{var u=n.getContaining(function(t){return"P"===t.nodeName});if(u){var s=e.nextSiblings(u);if(s.size){for(var a=document.createElement(i.nodeName);s.size;)a.appendChild(s.first()),s=s.shift();i.parentNode.insertBefore(a,i.nextElementSibling)}n.placeMarkers(),i.parentNode.insertBefore(u,i.nextElementSibling),n.selectMarkers(),""===i.innerHTML&&i.parentNode.removeChild(i)}else t.api.CommandPatch.prototype.execute.call(this)}}.bind(this))},t.commandPatches.outdent=n}}}),define("plugins/core/patches/commands/create-link",[],function(){"use strict";return function(){return function(t){var e=new t.api.CommandPatch("createLink");t.commandPatches.createLink=e,e.execute=function(e){var n=new t.api.Selection;if(n.range.collapsed){var r=document.createElement("a");r.setAttribute("href",e),r.textContent=e,n.range.insertNode(r);var i=document.createRange();i.setStartBefore(r),i.setEndAfter(r),n.selection.removeAllRanges(),n.selection.addRange(i)}else t.api.CommandPatch.prototype.execute.call(this,e)}}}}),define("plugins/core/patches/events",[],function(){"use strict";return function(){return function(t){var e=t.node;t.allowsBlockElements()&&t.el.addEventListener("keyup",function(n){if(8===n.keyCode||46===n.keyCode){var r=new t.api.Selection,i=r.getContaining(function(t){return"P"===t.nodeName});i&&t.transactionManager.run(function(){r.placeMarkers(),e.removeChromeArtifacts(i),r.selectMarkers()},!0)}})}}}),define("plugins/core/patches",["./patches/commands/bold","./patches/commands/indent","./patches/commands/insert-html","./patches/commands/insert-list","./patches/commands/outdent","./patches/commands/create-link","./patches/events"],function(t,e,n,r,i,o,u){"use strict";return{commands:{bold:t,indent:e,insertHTML:n,insertList:r,outdent:i,createLink:o},events:u}}),define("api/command-patch",[],function(){"use strict";return function(t){function e(t){this.commandName=t}return e.prototype.execute=function(e){t.transactionManager.run(function(){document.execCommand(this.commandName,!1,e||null)}.bind(this))},e.prototype.queryState=function(){return document.queryCommandState(this.commandName)},e.prototype.queryEnabled=function(){return document.queryCommandEnabled(this.commandName)},e}}),define("api/command",[],function(){"use strict";return function(t){function e(e){this.commandName=e,this.patch=t.commandPatches[this.commandName]}return e.prototype.execute=function(e){this.patch?this.patch.execute(e):t.transactionManager.run(function(){document.execCommand(this.commandName,!1,e||null)}.bind(this))},e.prototype.queryState=function(){return this.patch?this.patch.queryState():document.queryCommandState(this.commandName)},e.prototype.queryEnabled=function(){return this.patch?this.patch.queryEnabled():document.queryCommandEnabled(this.commandName)},e}}),define("api/selection",[],function(){"use strict";return function(t){function e(){var t=document.createElement("em");return t.style.display="none",t.classList.add("scribe-marker"),t}function n(t,e){t.insertNode(e),e.nextSibling&&o.isEmptyTextNode(e.nextSibling)&&o.removeNode(e.nextSibling),e.previousSibling&&o.isEmptyTextNode(e.previousSibling)&&o.removeNode(e.previousSibling)}function r(){if(this.selection=i.getSelection(),this.selection.rangeCount&&this.selection.anchorNode){var t=this.selection.anchorNode,e=this.selection.anchorOffset,n=this.selection.focusNode,r=this.selection.focusOffset;if(t===n&&e>r){var u=e;e=r,r=u}else if(o.isBefore(n,t)){var s=t,a=e;t=n,e=r,n=s,r=a}this.range=document.createRange(),this.range.setStart(t,e),this.range.setEnd(n,r)}}var i=t.el.ownerDocument,o=t.node;if(i.compareDocumentPosition(t.el)&Node.DOCUMENT_POSITION_DISCONNECTED){for(var u=t.el.parentNode;u&&o.isFragment(u);)u=u.parentNode;u&&u.getSelection&&(i=u)}return r.prototype.getContaining=function(e){var n=this.range;if(n){var r=this.range.commonAncestorContainer;return r&&t.el===r||!e(r)?o.getAncestor(r,t.el,e):r}},r.prototype.placeMarkers=function(){var r=this.range;if(r&&document.contains(t.el)&&t.el.contains(r.startContainer)&&t.el.contains(r.endContainer)){if(n(r.cloneRange(),e()),!r.collapsed){var i=r.cloneRange();i.collapse(!1),n(i,e())}this.selection.removeAllRanges(),this.selection.addRange(r)}},r.prototype.getMarkers=function(){return t.el.querySelectorAll("em.scribe-marker")},r.prototype.removeMarkers=function(){Array.prototype.forEach.call(this.getMarkers(),function(t){var e=t.parentNode;o.removeNode(t),e.normalize()})},r.prototype.selectMarkers=function(t){var e=this.getMarkers();if(e.length){var n=document.createRange();n.setStartBefore(e[0]),n.setEndAfter(e.length>=2?e[1]:e[0]),t||this.removeMarkers(),this.selection.removeAllRanges(),this.selection.addRange(n)}},r.prototype.isCaretOnNewLine=function(){var t=this.getContaining(function(t){return"P"===t.nodeName});return!!t&&o.isEmptyInlineElement(t)},r}}),define("api/simple-command",[],function(){"use strict";return function(t,e){function n(t,n){e.api.Command.call(this,t),this._nodeName=n}return n.prototype=Object.create(t.Command.prototype),n.prototype.constructor=n,n.prototype.queryState=function(){var t=new e.api.Selection;return e.api.Command.prototype.queryState.call(this)&&!!t.getContaining(function(t){return t.nodeName===this._nodeName}.bind(this))},n}}),define("api",["./api/command-patch","./api/command","./api/selection","./api/simple-command"],function(t,e,n,r){"use strict";return function(i){this.CommandPatch=t(i),this.Command=e(i),this.Selection=n(i),this.SimpleCommand=r(this,i)}}),define("lodash-amd/modern/internal/baseCopy",[],function(){function t(t,e,n){n||(n=e,e={});for(var r=-1,i=n.length;++r<i;){var o=n[r];e[o]=t[o]}return e}return t}),define("lodash-amd/modern/internal/isLength",[],function(){function t(t){return"number"==typeof t&&t>-1&&t%1==0&&e>=t}var e=Math.pow(2,53)-1;return t}),define("lodash-amd/modern/string/escapeRegExp",["../internal/baseToString"],function(t){function e(e){return e=t(e),e&&r.test(e)?e.replace(n,"\\$&"):e}var n=/[.*+?^${}()|[\]\/\\]/g,r=RegExp(n.source);return e}),define("lodash-amd/modern/internal/isObjectLike",[],function(){function t(t){return t&&"object"==typeof t||!1}return t}),define("lodash-amd/modern/lang/isNative",["../string/escapeRegExp","../internal/isObjectLike"],function(t,e){function n(t){return null==t?!1:s.call(t)==r?a.test(u.call(t)):e(t)&&i.test(t)||!1}var r="[object Function]",i=/^\[object .+?Constructor\]$/,o=Object.prototype,u=Function.prototype.toString,s=o.toString,a=RegExp("^"+t(s).replace(/toString|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?")+"$");return n}),define("lodash-amd/modern/lang/isObject",[],function(){function t(t){var e=typeof t;return"function"==e||t&&"object"==e||!1}return t}),define("lodash-amd/modern/lang/isArguments",["../internal/isLength","../internal/isObjectLike"],function(t,e){function n(n){var o=e(n)?n.length:r;return t(o)&&u.call(n)==i||!1}var r,i="[object Arguments]",o=Object.prototype,u=o.toString;return n}),define("lodash-amd/modern/lang/isArray",["../internal/isLength","./isNative","../internal/isObjectLike"],function(t,e,n){var r="[object Array]",i=Object.prototype,o=i.toString,u=e(u=Array.isArray)&&u,s=u||function(e){return n(e)&&t(e.length)&&o.call(e)==r||!1};return s}),define("lodash-amd/modern/internal/isIndex",[],function(){function t(t,n){return t=+t,n=null==n?e:n,t>-1&&t%1==0&&n>t}var e=Math.pow(2,53)-1;return t}),define("lodash-amd/modern/internal/root",[],function(){var t={"function":!0,object:!0},e=t[typeof exports]&&exports&&!exports.nodeType&&exports,n=t[typeof module]&&module&&!module.nodeType&&module,r=e&&n&&"object"==typeof global&&global,i=t[typeof window]&&window,o=r||i!==(this&&this.window)&&i||this;return o}),define("lodash-amd/modern/support",["./lang/isNative","./internal/root"],function(t,e){var n=/\bthis\b/,r=Object.prototype,i=(i=e.window)&&i.document,o=r.propertyIsEnumerable,u={};return function(r){u.funcDecomp=!t(e.WinRTError)&&n.test(function(){return this}),u.funcNames="string"==typeof Function.name;try{u.dom=11===i.createDocumentFragment().nodeType}catch(s){u.dom=!1}try{u.nonEnumArgs=!o.call(arguments,1)}catch(s){u.nonEnumArgs=!0}}(0,0),u}),define("lodash-amd/modern/object/keysIn",["../lang/isArguments","../lang/isArray","../internal/isIndex","../internal/isLength","../lang/isObject","../support"],function(t,e,n,r,i,o){function u(u){if(null==u)return[];i(u)||(u=Object(u));var s=u.length;s=s&&r(s)&&(e(u)||o.nonEnumArgs&&t(u))&&s||0;for(var c=u.constructor,f=-1,h="function"==typeof c&&c.prototype===u,l=Array(s),p=s>0;++f<s;)l[f]=f+"";for(var d in u)p&&n(d,s)||"constructor"==d&&(h||!a.call(u,d))||l.push(d);return l}var s=Object.prototype,a=s.hasOwnProperty;return u}),define("lodash-amd/modern/internal/shimKeys",["../lang/isArguments","../lang/isArray","./isIndex","./isLength","../object/keysIn","../support"],function(t,e,n,r,i,o){function u(u){for(var s=i(u),c=s.length,f=c&&u.length,h=f&&r(f)&&(e(u)||o.nonEnumArgs&&t(u)),l=-1,p=[];++l<c;){var d=s[l];(h&&n(d,f)||a.call(u,d))&&p.push(d)}return p}var s=Object.prototype,a=s.hasOwnProperty;return u}),define("lodash-amd/modern/object/keys",["../internal/isLength","../lang/isNative","../lang/isObject","../internal/shimKeys"],function(t,e,n,r){var i=e(i=Object.keys)&&i,o=i?function(e){if(e)var o=e.constructor,u=e.length;return"function"==typeof o&&o.prototype===e||"function"!=typeof e&&u&&t(u)?r(e):n(e)?i(e):[]}:r;return o}),define("lodash-amd/modern/internal/baseAssign",["./baseCopy","../object/keys"],function(t,e){function n(n,r,i){var o=e(r);if(!i)return t(r,n,o);for(var u=-1,s=o.length;++u<s;){var a=o[u],c=n[a],f=i(c,r[a],a,n,r);(f===f?f===c:c!==c)&&("undefined"!=typeof c||a in n)||(n[a]=f)}return n}return n}),define("lodash-amd/modern/utility/identity",[],function(){function t(t){return t}return t}),define("lodash-amd/modern/internal/bindCallback",["../utility/identity"],function(t){function e(e,n,r){if("function"!=typeof e)return t;if("undefined"==typeof n)return e;switch(r){case 1:return function(t){return e.call(n,t)};case 3:return function(t,r,i){return e.call(n,t,r,i)};case 4:return function(t,r,i,o){return e.call(n,t,r,i,o)};case 5:return function(t,r,i,o,u){return e.call(n,t,r,i,o,u)}}return function(){return e.apply(n,arguments)}}return e}),define("lodash-amd/modern/internal/isIterateeCall",["./isIndex","./isLength","../lang/isObject"],function(t,e,n){function r(r,i,o){if(!n(o))return!1;var u=typeof i;if("number"==u)var s=o.length,a=e(s)&&t(i,s);else a="string"==u&&i in o;if(a){var c=o[i];return r===r?r===c:c!==c}return!1}return r}),define("lodash-amd/modern/internal/createAssigner",["./bindCallback","./isIterateeCall"],function(t,e){function n(n){return function(){var r=arguments,i=r.length,o=r[0];if(2>i||null==o)return o;var u=r[i-2],s=r[i-1],a=r[3];i>3&&"function"==typeof u?(u=t(u,s,5),i-=2):(u=i>2&&"function"==typeof s?s:null,i-=u?1:0),a&&e(r[1],r[2],a)&&(u=3==i?null:u,i=2);for(var c=0;++c<i;){var f=r[c];f&&n(o,f,u)}return o}}return n}),define("lodash-amd/modern/object/assign",["../internal/baseAssign","../internal/createAssigner"],function(t,e){var n=e(t);return n}),define("transaction-manager",["lodash-amd/modern/object/assign"],function(t){"use strict";return function(e){function n(){this.history=[]}return t(n.prototype,{start:function(){this.history.push(1)},end:function(){this.history.pop(),0===this.history.length&&(e.pushHistory(),e.trigger("content-changed"))},run:function(t,n){this.start();try{t&&t()}finally{e._forceMerge=n===!0,this.end(),e._forceMerge=!1}}}),n}}),define("undo-manager",["immutable"],function(t){"use strict";function e(e,n){this._stack=t.List(),this._limit=e,this._fireEvent="undefined"!=typeof CustomEvent&&n&&n.dispatchEvent,this._ush=n,this.position=0,this.length=0}return e.prototype.transact=function(e,n){if(arguments.length<2)throw new TypeError("Not enough arguments to UndoManager.transact.");e.execute(),this.position>0&&this.clearRedo();var r;n&&this.length?(r=this._stack.first().push(e),this._stack=this._stack.shift().unshift(r)):(r=t.List.of(e),this._stack=this._stack.unshift(r),this.length++,this._limit&&this.length>this._limit&&this.clearUndo(this._limit)),this._dispatch("DOMTransaction",r)},e.prototype.undo=function(){if(!(this.position>=this.length)){for(var t=this._stack.get(this.position),e=t.size;e--;)t.get(e).undo();this.position++,this._dispatch("undo",t)}},e.prototype.redo=function(){if(0!==this.position){this.position--;for(var t=this._stack.get(this.position),e=0;e<t.size;e++)t.get(e).redo();this._dispatch("redo",t)}},e.prototype.item=function(t){return t>=0&&t<this.length?this._stack.get(t).toArray():null},e.prototype.clearUndo=function(t){this._stack=this._stack.take(void 0!==t?t:this.position),this.length=this._stack.size},e.prototype.clearRedo=function(){this._stack=this._stack.skip(this.position),this.length=this._stack.size,this.position=0},e.prototype._dispatch=function(t,e){this._fireEvent&&this._ush.dispatchEvent(new CustomEvent(t,{detail:{transactions:e.toArray()},bubbles:!0,cancelable:!1}))},e}),define("event-emitter",["immutable"],function(t){"use strict";function e(){this._listeners={}}return e.prototype.on=function(e,n){var r=this._listeners[e]||t.Set();this._listeners[e]=r.add(n)},e.prototype.off=function(e,n){var r=this._listeners[e]||t.Set();n?this._listeners[e]=r["delete"](n):this._listeners[e]=r.clear()},e.prototype.trigger=function(e,n){for(var r=e.split(":");r.length;){var i=r.join(":"),o=this._listeners[i]||t.Set();o.forEach(function(t){t.apply(null,n)}),r.splice(r.length-1,1)}},e}),define("config",["immutable"],function(t){function e(e,n){const r=t.fromJS(e),i=t.fromJS(n),o=i.merge(r);return o.toJS()}function n(t){var n=t||{};return n.defaultPlugins&&(n.defaultPlugins=n.defaultPlugins.filter(o(a.defaultPlugins))),n.defaultFormatters&&(n.defaultFormatters=n.defaultFormatters.filter(o(a.defaultFormatters))),Object.freeze(e(n,a))}function r(t){return function(e,n){return e===t?-1:n===t?1:0}}function i(t){return function(e){return-1!==(t?u:s).indexOf(e)}}function o(t){return function(e){return-1!==t.indexOf(e)}}var u=["setRootPElement","enforcePElements","ensureSelectableContainers"],s=["inlineElementsMode"],a={allowBlockElements:!0,debug:!1,undo:{manager:!1,enabled:!0,limit:100,interval:250},defaultCommandPatches:["bold","indent","insertHTML","insertList","outdent","createLink"],defaultPlugins:u.concat(s),defaultFormatters:["escapeHtmlCharactersFormatter","replaceNbspCharsFormatter"]};return{defaultOptions:a,checkOptions:n,sortByPlugin:r,filterByBlockLevelMode:i,filterByPluginExists:o}}),define("scribe",["./plugins/core/plugins","./plugins/core/commands","./plugins/core/formatters","./plugins/core/events","./plugins/core/patches","./api","./transaction-manager","./undo-manager","./event-emitter","./node","immutable","./config"],function(t,e,n,r,i,o,u,s,a,c,f,h){"use strict";function l(c,l){a.call(this),this.el=c,this.commands={},this.options=h.checkOptions(l),this.commandPatches={},this._plainTextFormatterFactory=new p,this._htmlFormatterFactory=new d,this.api=new o(this),this.Immutable=f;var m=u(this);this.transactionManager=new m,this.undoManager=!1,this.options.undo.enabled&&(this.options.undo.manager?this.undoManager=this.options.undo.manager:this.undoManager=new s(this.options.undo.limit,this.el),this._merge=!1,this._forceMerge=!1,this._mergeTimer=0,this._lastItem={content:""}),this.setHTML(this.getHTML()),this.el.setAttribute("contenteditable",!0),this.el.addEventListener("input",function(){this.transactionManager.run()}.bind(this),!1);var _=f.OrderedSet(this.options.defaultPlugins).sort(h.sortByPlugin("setRootPElement")).filter(h.filterByBlockLevelMode(this.allowsBlockElements())).map(function(e){return t[e]}),v=f.List(this.options.defaultFormatters).filter(function(t){return!!n[t]}).map(function(t){return n[t]}),y=f.List.of(i.events),g=f.List(this.options.defaultCommandPatches).map(function(t){return i.commands[t]}),b=f.List.of("indent","insertList","outdent","redo","subscript","superscript","undo").map(function(t){return e[t]}),w=f.List().concat(_,v,y,g,b);w.forEach(function(t){this.use(t())}.bind(this)),this.use(r())}function p(){this.formatters=f.List()}function d(){this.formatters={sanitize:f.List(),normalize:f.List(),"export":f.List()}}return l.prototype=Object.create(a.prototype),l.prototype.node=c,l.prototype.element=l.prototype.node,l.prototype.use=function(t){return t(this),this},l.prototype.setHTML=function(t,e){this.options.undo.enabled&&(this._lastItem.content=t),e&&(this._skipFormatters=!0),this.el.innerHTML!==t&&(this.el.innerHTML=t)},l.prototype.getHTML=function(){return this.el.innerHTML},l.prototype.getContent=function(){return this._htmlFormatterFactory.formatForExport(this.getHTML().replace(/<br>$/,""))},l.prototype.getTextContent=function(){return this.el.textContent},l.prototype.pushHistory=function(){var t=this;if(t.options.undo.enabled){var e=t._lastItem.content.replace(/<em [^>]*class="scribe-marker"[^>]*>[^<]*?<\/em>/g,"");if(t.getHTML()!==e){var n=new t.api.Selection;n.placeMarkers();var r=t.getHTML();n.removeMarkers();var i=t.undoManager.item(t.undoManager.position);return(t._merge||t._forceMerge)&&i&&t._lastItem==i[0]?t._lastItem.content=r:(t._lastItem={previousItem:t._lastItem,content:r,scribe:t,execute:function(){},undo:function(){this.scribe.restoreFromHistory(this.previousItem)},redo:function(){this.scribe.restoreFromHistory(this)}},t.undoManager.transact(t._lastItem,!1)),clearTimeout(t._mergeTimer),t._merge=!0,t._mergeTimer=setTimeout(function(){t._merge=!1},t.options.undo.interval),!0}}return!1},l.prototype.getCommand=function(t){return this.commands[t]||this.commandPatches[t]||new this.api.Command(t)},l.prototype.restoreFromHistory=function(t){this._lastItem=t,this.setHTML(t.content,!0);var e=new this.api.Selection;e.selectMarkers(),this.trigger("content-changed")},l.prototype.allowsBlockElements=function(){return this.options.allowBlockElements},l.prototype.setContent=function(t){this.allowsBlockElements()||(t+="<br>"),this.setHTML(t),this.trigger("content-changed")},l.prototype.insertPlainText=function(t){this.insertHTML("<p>"+this._plainTextFormatterFactory.format(t)+"</p>")},l.prototype.insertHTML=function(t){this.getCommand("insertHTML").execute(this._htmlFormatterFactory.format(t))},l.prototype.isDebugModeEnabled=function(){return this.options.debug},l.prototype.registerHTMLFormatter=function(t,e){this._htmlFormatterFactory.formatters[t]=this._htmlFormatterFactory.formatters[t].push(e)},l.prototype.registerPlainTextFormatter=function(t){this._plainTextFormatterFactory.formatters=this._plainTextFormatterFactory.formatters.push(t)},p.prototype.format=function(t){var e=this.formatters.reduce(function(t,e){return e(t)},t);return e},d.prototype=Object.create(p.prototype),d.prototype.constructor=d,d.prototype.format=function(t){var e=this.formatters.sanitize.concat(this.formatters.normalize),n=e.reduce(function(t,e){return e(t)},t);return n},d.prototype.formatForExport=function(t){return this.formatters["export"].reduce(function(t,e){return e(t)},t)},l});
//# sourceMappingURL=scribe.min.js.map;
define("scribe-plugin-toolbar",[],function(){"use strict";var e=null;return function(t,a){var n={shared:!1};return a||(a=n),a=Object.freeze(a),function(n){a.shared&&n.el.addEventListener("focus",function(){e=n.el});var d=t.querySelectorAll("[data-command-name]");Array.prototype.forEach.call(d,function(t){function d(){var e=n.getCommand(t.dataset.commandName),a=new n.api.Selection;a.range&&e.queryState(t.dataset.commandValue)?t.classList.add("active"):t.classList.remove("active"),a.range&&e.queryEnabled()?t.removeAttribute("disabled"):t.setAttribute("disabled","disabled")}t.addEventListener("mousedown",function(){if(!a.shared||n.el===e){var d=n.getCommand(t.dataset.commandName);n.el.focus(),d.execute(t.dataset.commandValue)}}),n.el.addEventListener("keyup",d),n.el.addEventListener("mouseup",d),n.el.addEventListener("focus",d),n.el.addEventListener("blur",d),n.on("content-changed",d)})}}});
//# sourceMappingURL=scribe-plugin-toolbar.min.js.map;
/**
 * TODO: Create a seprate cn SCRIBE Repository where all the custom plugins and
 * and scribe will be found.
 */
define('scribe-plugin-cn-link-create',[],function() {

    /**
     * Class showing prompts
     * @param options
     * @returns {Prompt}
     * @constructor
     */
    var Prompt = (function(){
        var self = this;
        this.instance = null;
        this.patterns = [
            /*{
             attribute: 'href',
             pattern: /^((http(s)?)|(mailto)|(tel))\:\/\/)[a-z0-9_\-\.]+(\?.*)?/i
             }*/
        ];

        /**
         * Template of the window.
         * The extension looks for the .data inputs/selects and uses the data-name for mapping of the link-attributes
         */
        this.template = '<div class="prompt" style="position: fixed; top: calc(50% - 100px); left: calc(50% - 100px);">' +
            '  <ul>' +
            '      <li>' +
            '          Url: <input class="data form-control" name="scribe-link-href" data-name="href" value="">' +
            '      </li>' +
            '      <li>' +
            '          Target: ' +
            '          <select class="data form-control" data-name="target">' +
            '              <option value="">Same Window</option>' +
            '              <option value="_blank">New Window</option>' +
            '              <option value="_top">Parent Window</option>' +
            '          </select>' +
            '      </li>' +
            '      <li>' +
            '          Rel: ' +
            '          <select class="data form-control" data-name="rel">' +
            '              <option value="">Follow</option>' +
            '              <option value="nofollow">No follow</option>' +
            '              <!--option value="alternate">Alternate</option-->' +
            '              <!--option value="author">Author</option-->' +
            '              <!--option value="external">External</option-->' +
            '              <!--option value="tag">Tag</option-->' +
            '              <!--option value="prev">Previous</option-->' +
            '              <!--option value="next">Next</option-->' +
            '          </select>' +
            '      </li>' +
            '      <li style="display: none">' +
            '          id: <input class="data form-control" name="scribe-link-id" data-name="name" value="">' +
            '      </li>' +
            '  </ul>' +
            ' <div class="buttons">' +
            '    <button name="cancel" class="btn">Cancel</button><button name="ok" class="btn btn-success">Save</button>' +
            ' </div>' +
            '</div>';

        /**
         * Shows the window with initial values, that correspond to the data-name attributes
         * @param initial
         */
        this.show = function(options) {

            options.initial = options.initial || {};

            if(self.instance)
                this.remove();

            self.instance = $(self.template);
            $('body').append(self.instance);
            self.instance.find('.data').each(function(){
                var val = options.initial[$(this).attr('data-name')] || '';
                $(this).val(val);
                $(this).find('option[value="'+val+'"]').attr('selected','selected');
            });

            if(options.hasOwnProperty('onShow'))
                options.onShow();

            var data = $(self.instance).find('.data');

            $(self.instance).find('button[name="ok"]').on('click', function(event) {
                self.ok(event, data, options.onOK || null );
            });

            $(self.instance).find('button[name="cancel"]').on('click', function(event){
                self.cancel(event, data, options.onCancel || null)
            });

        };

        /**
         *
         * @returns {*}
         */
        this.validate = function() {

            $(self.instance).find('.data').removeClass('error');

            return self.patterns.reduce(function(isValid, check) {
                var element = $(self.instance).find('[data-name="'+check.attribute+'"]');
                var matched = String(element.val()).match(check.pattern);

                if(element && matched == null) {
                    element.addClass('error');
                    element.focus();
                }

                return isValid && matched != null;
            }, true)
        };

        /**
         * Hides the window
         */
        this.remove = function() {
            $(self.instance).remove();
        };

        /**
         * Ok action
         * @param event
         * @param data
         */
        this.ok = function(event, data, callback) {

            if(this.validate()) {
                if(typeof callback === 'function')
                    callback(event, data);

                self.remove();
            }

        };

        /**
         * Cancel action
         * @param event
         * @param data
         */
        this.cancel = function(event, data, callback) {

            if(typeof callback === 'function')
                callback(event, data);

            self.remove();
        };

        return this;
    })();

    /**
     * The real scribe Plugin
     */
    return function (options) {

        return function (scribe) {

            var linkPromptCommand = new scribe.api.CommandPatch('cnCreateLink');
            linkPromptCommand.nodeName = 'A';

            /**
             * The command actions
             * @param passedLink
             */
            linkPromptCommand.execute = function (passedLink) {
                // gets the selection
                var selection = new scribe.api.Selection();
                var range = selection.range;

                // checks if its an existing node
                var anchorNode = selection.getContaining(function (node) {
                    return node.nodeName === this.nodeName;
                }.bind(this));

                // constructs the propmp data
                var linkConfig = {
                    href: anchorNode ? anchorNode.href : '',
                    target: anchorNode ? anchorNode.target : '',
                    rel: anchorNode ? anchorNode.rel : '',
                    id: anchorNode ? anchorNode.id : ''
                };

                // converts the selection to text
                var linkText = window.getSelection().toString();

                // configures the prompt window
                Prompt.show({
                    initial: linkConfig,
                    onOK: function (event, data) {

                        // Reads the input data from the input fields
                        data.each(function (index, el) {
                            linkConfig[$(el).attr('data-name')] = $(el).val();
                        });

                        if (anchorNode !== undefined) {
                            range.selectNode(anchorNode);
                            selection.selection.removeAllRanges();
                            selection.selection.addRange(range);
                        }

                        if (selection.range) {

                            // creates a new link element
                            var aElement = document.createElement('a');

                            // populates the mapped values of the link
                            for (var attr in linkConfig)
                                if (linkConfig.hasOwnProperty(attr) && linkConfig[attr].length > 0)
                                    aElement.setAttribute(attr, linkConfig[attr]);

                            aElement.textContent = linkText;

                            scribe.transactionManager.run(function () {
                                // deletes the selected thing
                                selection.range.deleteContents();
                                // inserts the new link
                                if(aElement.href) {
                                    selection.range.insertNode(aElement);

                                    // Select the created link
                                    var newRange = document.createRange();
                                    newRange.setStartBefore(aElement);
                                    newRange.setEndAfter(aElement);

                                    selection.selection.removeAllRanges();
                                    selection.selection.addRange(newRange);

                                } else {
                                    selection.range.insertNode(document.createTextNode(linkText));
                                }
                            });

                        } else {
                            scribe.api.CommandPatch.prototype.execute.call(linkPromptCommand, value);
                        }
                    }
                });
            };

            /**
             * The command is always enabled
             * TODO: Extend this function to make a proper check
             * @returns {boolean}
             */
            linkPromptCommand.queryEnabled = function() {
                return true;
            };

            /**
             * Checks if the command is applicabale
             * @returns {boolean}
             */
            linkPromptCommand.queryState = function () {
                /**
                 * We override the native `document.queryCommandState` for links because
                 * the `createLink` and `unlink` commands are not supported.
                 * As per: http://jsbin.com/OCiJUZO/1/edit?js,console,output
                 */
                var selection = new scribe.api.Selection();
                return !!selection.getContaining(function (node) {
                    return node.nodeName === this.nodeName;
                }.bind(this));
            };

            scribe.commandPatches.cnCreateLink = linkPromptCommand;
        };
    };
});
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define('html-janitor', factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.HTMLJanitor = factory();
  }
}(this, function () {

  /**
   * @param {Object} config.tags Dictionary of allowed tags.
   * @param {boolean} config.keepNestedBlockElements Default false.
   */
  function HTMLJanitor(config) {

    var tagDefinitions = config['tags'];
    var tags = Object.keys(tagDefinitions);

    var validConfigValues = tags
      .map(function(k) { return typeof tagDefinitions[k]; })
      .every(function(type) { return type === 'object' || type === 'boolean' || type === 'function'; });

    if(!validConfigValues) {
      throw new Error("The configuration was invalid");
    }

    this.config = config;
  }

  // TODO: not exhaustive?
  var blockElementNames = ['P', 'LI', 'TD', 'TH', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE'];
  function isBlockElement(node) {
    return blockElementNames.indexOf(node.nodeName) !== -1;
  }

  var inlineElementNames = ['A', 'B', 'STRONG', 'I', 'EM', 'SUB', 'SUP', 'U', 'STRIKE'];
  function isInlineElement(node) {
    return inlineElementNames.indexOf(node.nodeName) !== -1;
  }

  HTMLJanitor.prototype.clean = function (html) {
    var sandbox = document.createElement('div');
    sandbox.innerHTML = html;

    this._sanitize(sandbox);

    return sandbox.innerHTML;
  };

  HTMLJanitor.prototype._sanitize = function (parentNode) {
    var treeWalker = createTreeWalker(parentNode);
    var node = treeWalker.firstChild();
    if (!node) { return; }

    do {
      // Ignore nodes that have already been sanitized
      if (node._sanitized) {
        continue;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        // If this text node is just whitespace and the previous or next element
        // sibling is a block element, remove it
        // N.B.: This heuristic could change. Very specific to a bug with
        // `contenteditable` in Firefox: http://jsbin.com/EyuKase/1/edit?js,output
        // FIXME: make this an option?
        if (node.data.trim() === ''
            && ((node.previousElementSibling && isBlockElement(node.previousElementSibling))
                 || (node.nextElementSibling && isBlockElement(node.nextElementSibling)))) {
          parentNode.removeChild(node);
          this._sanitize(parentNode);
          break;
        } else {
          continue;
        }
      }

      // Remove all comments
      if (node.nodeType === Node.COMMENT_NODE) {
        parentNode.removeChild(node);
        this._sanitize(parentNode);
        break;
      }

      var isInline = isInlineElement(node);
      var containsBlockElement;
      if (isInline) {
        containsBlockElement = Array.prototype.some.call(node.childNodes, isBlockElement);
      }

      // Block elements should not be nested (e.g. <li><p>...); if
      // they are, we want to unwrap the inner block element.
      var isNotTopContainer = !! parentNode.parentNode;
      var isNestedBlockElement =
            isBlockElement(parentNode) &&
            isBlockElement(node) &&
            isNotTopContainer;

      var nodeName = node.nodeName.toLowerCase();

      var allowedAttrs = getAllowedAttrs(this.config, nodeName, node);

      var isInvalid = isInline && containsBlockElement;

      // Drop tag entirely according to the whitelist *and* if the markup
      // is invalid.
      if (isInvalid || shouldRejectNode(node, allowedAttrs)
          || (!this.config.keepNestedBlockElements && isNestedBlockElement)) {
        // Do not keep the inner text of SCRIPT/STYLE elements.
        if (! (node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE')) {
          while (node.childNodes.length > 0) {
            parentNode.insertBefore(node.childNodes[0], node);
          }
        }
        parentNode.removeChild(node);

        this._sanitize(parentNode);
        break;
      }

      // Sanitize attributes
      for (var a = 0; a < node.attributes.length; a += 1) {
        var attr = node.attributes[a];

        if (shouldRejectAttr(attr, allowedAttrs, node)) {
          node.removeAttribute(attr.name);
          // Shift the array to continue looping.
          a = a - 1;
        }
      }

      // Sanitize children
      this._sanitize(node);

      // Mark node as sanitized so it's ignored in future runs
      node._sanitized = true;
    } while ((node = treeWalker.nextSibling()));
  };

  function createTreeWalker(node) {
    return document.createTreeWalker(node,
                                     NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
                                     null, false);
  }

  function getAllowedAttrs(config, nodeName, node){
    if (typeof config.tags[nodeName] === 'function') {
      return config.tags[nodeName](node);
    } else {
      return config.tags[nodeName];
    }
  }

  function shouldRejectNode(node, allowedAttrs){
    if (typeof allowedAttrs === 'undefined') {
      return true;
    } else if (typeof allowedAttrs === 'boolean') {
      return !allowedAttrs;
    }

    return false;
  }

  function shouldRejectAttr(attr, allowedAttrs, node){
    var attrName = attr.name.toLowerCase();

    if (allowedAttrs === true){
      return false;
    } else if (typeof allowedAttrs[attrName] === 'function'){
      return !allowedAttrs[attrName](attr.value, node);
    } else if (typeof allowedAttrs[attrName] === 'undefined'){
      return true;
    } else if (allowedAttrs[attrName] === false) {
      return true;
    } else if (typeof allowedAttrs[attrName] === 'string') {
      return (allowedAttrs[attrName] !== attr.value);
    }

    return false;
  }

  return HTMLJanitor;

}));


//# sourceMappingURL=html-janitor.js.map;
define('lodash-amd/modern/internal/arrayEach',[], function() {

  /**
   * A specialized version of `_.forEach` for arrays without support for callback
   * shorthands or `this` binding.
   *
   * @private
   * @param {Array} array The array to iterate over.
   * @param {Function} iteratee The function invoked per iteration.
   * @returns {Array} Returns `array`.
   */
  function arrayEach(array, iteratee) {
    var index = -1,
        length = array.length;

    while (++index < length) {
      if (iteratee(array[index], index, array) === false) {
        break;
      }
    }
    return array;
  }

  return arrayEach;
});

define('lodash-amd/modern/lang/isObject',[], function() {

  /**
   * Checks if `value` is the language type of `Object`.
   * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
   *
   * **Note:** See the [ES5 spec](https://es5.github.io/#x8) for more details.
   *
   * @static
   * @memberOf _
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is an object, else `false`.
   * @example
   *
   * _.isObject({});
   * // => true
   *
   * _.isObject([1, 2, 3]);
   * // => true
   *
   * _.isObject(1);
   * // => false
   */
  function isObject(value) {
    // Avoid a V8 JIT bug in Chrome 19-20.
    // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
    var type = typeof value;
    return type == 'function' || (value && type == 'object') || false;
  }

  return isObject;
});

define('lodash-amd/modern/internal/toObject',['../lang/isObject'], function(isObject) {

  /**
   * Converts `value` to an object if it is not one.
   *
   * @private
   * @param {*} value The value to process.
   * @returns {Object} Returns the object.
   */
  function toObject(value) {
    return isObject(value) ? value : Object(value);
  }

  return toObject;
});

define('lodash-amd/modern/internal/baseFor',['./toObject'], function(toObject) {

  /**
   * The base implementation of `baseForIn` and `baseForOwn` which iterates
   * over `object` properties returned by `keysFunc` invoking `iteratee` for
   * each property. Iterator functions may exit iteration early by explicitly
   * returning `false`.
   *
   * @private
   * @param {Object} object The object to iterate over.
   * @param {Function} iteratee The function invoked per iteration.
   * @param {Function} keysFunc The function to get the keys of `object`.
   * @returns {Object} Returns `object`.
   */
  function baseFor(object, iteratee, keysFunc) {
    var index = -1,
        iterable = toObject(object),
        props = keysFunc(object),
        length = props.length;

    while (++index < length) {
      var key = props[index];
      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }
    return object;
  }

  return baseFor;
});

define('lodash-amd/modern/internal/isLength',[], function() {

  /**
   * Used as the maximum length of an array-like value.
   * See the [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-number.max_safe_integer)
   * for more details.
   */
  var MAX_SAFE_INTEGER = Math.pow(2, 53) - 1;

  /**
   * Checks if `value` is a valid array-like length.
   *
   * **Note:** This function is based on ES `ToLength`. See the
   * [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength)
   * for more details.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
   */
  function isLength(value) {
    return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
  }

  return isLength;
});

define('lodash-amd/modern/internal/baseToString',[], function() {

  /**
   * Converts `value` to a string if it is not one. An empty string is returned
   * for `null` or `undefined` values.
   *
   * @private
   * @param {*} value The value to process.
   * @returns {string} Returns the string.
   */
  function baseToString(value) {
    if (typeof value == 'string') {
      return value;
    }
    return value == null ? '' : (value + '');
  }

  return baseToString;
});

define('lodash-amd/modern/string/escapeRegExp',['../internal/baseToString'], function(baseToString) {

  /**
   * Used to match `RegExp` special characters.
   * See this [article on `RegExp` characters](http://www.regular-expressions.info/characters.html#special)
   * for more details.
   */
  var reRegExpChars = /[.*+?^${}()|[\]\/\\]/g,
      reHasRegExpChars = RegExp(reRegExpChars.source);

  /**
   * Escapes the `RegExp` special characters "\", "^", "$", ".", "|", "?", "*",
   * "+", "(", ")", "[", "]", "{" and "}" in `string`.
   *
   * @static
   * @memberOf _
   * @category String
   * @param {string} [string=''] The string to escape.
   * @returns {string} Returns the escaped string.
   * @example
   *
   * _.escapeRegExp('[lodash](https://lodash.com/)');
   * // => '\[lodash\]\(https://lodash\.com/\)'
   */
  function escapeRegExp(string) {
    string = baseToString(string);
    return (string && reHasRegExpChars.test(string))
      ? string.replace(reRegExpChars, '\\$&')
      : string;
  }

  return escapeRegExp;
});

define('lodash-amd/modern/internal/isObjectLike',[], function() {

  /**
   * Checks if `value` is object-like.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
   */
  function isObjectLike(value) {
    return (value && typeof value == 'object') || false;
  }

  return isObjectLike;
});

define('lodash-amd/modern/lang/isNative',['../string/escapeRegExp', '../internal/isObjectLike'], function(escapeRegExp, isObjectLike) {

  /** `Object#toString` result references. */
  var funcTag = '[object Function]';

  /** Used to detect host constructors (Safari > 5). */
  var reHostCtor = /^\[object .+?Constructor\]$/;

  /** Used for native method references. */
  var objectProto = Object.prototype;

  /** Used to resolve the decompiled source of functions. */
  var fnToString = Function.prototype.toString;

  /**
   * Used to resolve the `toStringTag` of values.
   * See the [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-object.prototype.tostring)
   * for more details.
   */
  var objToString = objectProto.toString;

  /** Used to detect if a method is native. */
  var reNative = RegExp('^' +
    escapeRegExp(objToString)
    .replace(/toString|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
  );

  /**
   * Checks if `value` is a native function.
   *
   * @static
   * @memberOf _
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
   * @example
   *
   * _.isNative(Array.prototype.push);
   * // => true
   *
   * _.isNative(_);
   * // => false
   */
  function isNative(value) {
    if (value == null) {
      return false;
    }
    if (objToString.call(value) == funcTag) {
      return reNative.test(fnToString.call(value));
    }
    return (isObjectLike(value) && reHostCtor.test(value)) || false;
  }

  return isNative;
});

define('lodash-amd/modern/lang/isArguments',['../internal/isLength', '../internal/isObjectLike'], function(isLength, isObjectLike) {

  /** Used as a safe reference for `undefined` in pre-ES5 environments. */
  var undefined;

  /** `Object#toString` result references. */
  var argsTag = '[object Arguments]';

  /** Used for native method references. */
  var objectProto = Object.prototype;

  /**
   * Used to resolve the `toStringTag` of values.
   * See the [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-object.prototype.tostring)
   * for more details.
   */
  var objToString = objectProto.toString;

  /**
   * Checks if `value` is classified as an `arguments` object.
   *
   * @static
   * @memberOf _
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
   * @example
   *
   * _.isArguments(function() { return arguments; }());
   * // => true
   *
   * _.isArguments([1, 2, 3]);
   * // => false
   */
  function isArguments(value) {
    var length = isObjectLike(value) ? value.length : undefined;
    return (isLength(length) && objToString.call(value) == argsTag) || false;
  }

  return isArguments;
});

define('lodash-amd/modern/lang/isArray',['../internal/isLength', './isNative', '../internal/isObjectLike'], function(isLength, isNative, isObjectLike) {

  /** `Object#toString` result references. */
  var arrayTag = '[object Array]';

  /** Used for native method references. */
  var objectProto = Object.prototype;

  /**
   * Used to resolve the `toStringTag` of values.
   * See the [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-object.prototype.tostring)
   * for more details.
   */
  var objToString = objectProto.toString;

  /* Native method references for those with the same name as other `lodash` methods. */
  var nativeIsArray = isNative(nativeIsArray = Array.isArray) && nativeIsArray;

  /**
   * Checks if `value` is classified as an `Array` object.
   *
   * @static
   * @memberOf _
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
   * @example
   *
   * _.isArray([1, 2, 3]);
   * // => true
   *
   * _.isArray(function() { return arguments; }());
   * // => false
   */
  var isArray = nativeIsArray || function(value) {
    return (isObjectLike(value) && isLength(value.length) && objToString.call(value) == arrayTag) || false;
  };

  return isArray;
});

define('lodash-amd/modern/internal/isIndex',[], function() {

  /**
   * Used as the maximum length of an array-like value.
   * See the [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-number.max_safe_integer)
   * for more details.
   */
  var MAX_SAFE_INTEGER = Math.pow(2, 53) - 1;

  /**
   * Checks if `value` is a valid array-like index.
   *
   * @private
   * @param {*} value The value to check.
   * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
   * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
   */
  function isIndex(value, length) {
    value = +value;
    length = length == null ? MAX_SAFE_INTEGER : length;
    return value > -1 && value % 1 == 0 && value < length;
  }

  return isIndex;
});

define('lodash-amd/modern/internal/root',[], function() {

  /** Used to determine if values are of the language type `Object`. */
  var objectTypes = {
    'function': true,
    'object': true
  };

  /** Detect free variable `exports`. */
  var freeExports = objectTypes[typeof exports] && exports && !exports.nodeType && exports;

  /** Detect free variable `module`. */
  var freeModule = objectTypes[typeof module] && module && !module.nodeType && module;

  /** Detect free variable `global` from Node.js. */
  var freeGlobal = freeExports && freeModule && typeof global == 'object' && global;

  /** Detect free variable `window`. */
  var freeWindow = objectTypes[typeof window] && window;

  /**
   * Used as a reference to the global object.
   *
   * The `this` value is used if it is the global object to avoid Greasemonkey's
   * restricted `window` object, otherwise the `window` object is used.
   */
  var root = freeGlobal || ((freeWindow !== (this && this.window)) && freeWindow) || this;

  return root;
});

define('lodash-amd/modern/support',['./lang/isNative', './internal/root'], function(isNative, root) {

  /** Used to detect functions containing a `this` reference. */
  var reThis = /\bthis\b/;

  /** Used for native method references. */
  var objectProto = Object.prototype;

  /** Used to detect DOM support. */
  var document = (document = root.window) && document.document;

  /** Native method references. */
  var propertyIsEnumerable = objectProto.propertyIsEnumerable;

  /**
   * An object environment feature flags.
   *
   * @static
   * @memberOf _
   * @type Object
   */
  var support = {};

  (function(x) {

    /**
     * Detect if functions can be decompiled by `Function#toString`
     * (all but Firefox OS certified apps, older Opera mobile browsers, and
     * the PlayStation 3; forced `false` for Windows 8 apps).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.funcDecomp = !isNative(root.WinRTError) && reThis.test(function() { return this; });

    /**
     * Detect if `Function#name` is supported (all but IE).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.funcNames = typeof Function.name == 'string';

    /**
     * Detect if the DOM is supported.
     *
     * @memberOf _.support
     * @type boolean
     */
    try {
      support.dom = document.createDocumentFragment().nodeType === 11;
    } catch(e) {
      support.dom = false;
    }

    /**
     * Detect if `arguments` object indexes are non-enumerable.
     *
     * In Firefox < 4, IE < 9, PhantomJS, and Safari < 5.1 `arguments` object
     * indexes are non-enumerable. Chrome < 25 and Node.js < 0.11.0 treat
     * `arguments` object indexes as non-enumerable and fail `hasOwnProperty`
     * checks for indexes that exceed their function's formal parameters with
     * associated values of `0`.
     *
     * @memberOf _.support
     * @type boolean
     */
    try {
      support.nonEnumArgs = !propertyIsEnumerable.call(arguments, 1);
    } catch(e) {
      support.nonEnumArgs = true;
    }
  }(0, 0));

  return support;
});

define('lodash-amd/modern/object/keysIn',['../lang/isArguments', '../lang/isArray', '../internal/isIndex', '../internal/isLength', '../lang/isObject', '../support'], function(isArguments, isArray, isIndex, isLength, isObject, support) {

  /** Used for native method references. */
  var objectProto = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty = objectProto.hasOwnProperty;

  /**
   * Creates an array of the own and inherited enumerable property names of `object`.
   *
   * **Note:** Non-object values are coerced to objects.
   *
   * @static
   * @memberOf _
   * @category Object
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns the array of property names.
   * @example
   *
   * function Foo() {
   *   this.a = 1;
   *   this.b = 2;
   * }
   *
   * Foo.prototype.c = 3;
   *
   * _.keysIn(new Foo);
   * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
   */
  function keysIn(object) {
    if (object == null) {
      return [];
    }
    if (!isObject(object)) {
      object = Object(object);
    }
    var length = object.length;
    length = (length && isLength(length) &&
      (isArray(object) || (support.nonEnumArgs && isArguments(object))) && length) || 0;

    var Ctor = object.constructor,
        index = -1,
        isProto = typeof Ctor == 'function' && Ctor.prototype === object,
        result = Array(length),
        skipIndexes = length > 0;

    while (++index < length) {
      result[index] = (index + '');
    }
    for (var key in object) {
      if (!(skipIndexes && isIndex(key, length)) &&
          !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
        result.push(key);
      }
    }
    return result;
  }

  return keysIn;
});

define('lodash-amd/modern/internal/shimKeys',['../lang/isArguments', '../lang/isArray', './isIndex', './isLength', '../object/keysIn', '../support'], function(isArguments, isArray, isIndex, isLength, keysIn, support) {

  /** Used for native method references. */
  var objectProto = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty = objectProto.hasOwnProperty;

  /**
   * A fallback implementation of `Object.keys` which creates an array of the
   * own enumerable property names of `object`.
   *
   * @private
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns the array of property names.
   */
  function shimKeys(object) {
    var props = keysIn(object),
        propsLength = props.length,
        length = propsLength && object.length;

    var allowIndexes = length && isLength(length) &&
      (isArray(object) || (support.nonEnumArgs && isArguments(object)));

    var index = -1,
        result = [];

    while (++index < propsLength) {
      var key = props[index];
      if ((allowIndexes && isIndex(key, length)) || hasOwnProperty.call(object, key)) {
        result.push(key);
      }
    }
    return result;
  }

  return shimKeys;
});

define('lodash-amd/modern/object/keys',['../internal/isLength', '../lang/isNative', '../lang/isObject', '../internal/shimKeys'], function(isLength, isNative, isObject, shimKeys) {

  /* Native method references for those with the same name as other `lodash` methods. */
  var nativeKeys = isNative(nativeKeys = Object.keys) && nativeKeys;

  /**
   * Creates an array of the own enumerable property names of `object`.
   *
   * **Note:** Non-object values are coerced to objects. See the
   * [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-object.keys)
   * for more details.
   *
   * @static
   * @memberOf _
   * @category Object
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns the array of property names.
   * @example
   *
   * function Foo() {
   *   this.a = 1;
   *   this.b = 2;
   * }
   *
   * Foo.prototype.c = 3;
   *
   * _.keys(new Foo);
   * // => ['a', 'b'] (iteration order is not guaranteed)
   *
   * _.keys('hi');
   * // => ['0', '1']
   */
  var keys = !nativeKeys ? shimKeys : function(object) {
    if (object) {
      var Ctor = object.constructor,
          length = object.length;
    }
    if ((typeof Ctor == 'function' && Ctor.prototype === object) ||
        (typeof object != 'function' && (length && isLength(length)))) {
      return shimKeys(object);
    }
    return isObject(object) ? nativeKeys(object) : [];
  };

  return keys;
});

define('lodash-amd/modern/internal/baseForOwn',['./baseFor', '../object/keys'], function(baseFor, keys) {

  /**
   * The base implementation of `_.forOwn` without support for callback
   * shorthands and `this` binding.
   *
   * @private
   * @param {Object} object The object to iterate over.
   * @param {Function} iteratee The function invoked per iteration.
   * @returns {Object} Returns `object`.
   */
  function baseForOwn(object, iteratee) {
    return baseFor(object, iteratee, keys);
  }

  return baseForOwn;
});

define('lodash-amd/modern/internal/arrayCopy',[], function() {

  /**
   * Copies the values of `source` to `array`.
   *
   * @private
   * @param {Array} source The array to copy values from.
   * @param {Array} [array=[]] The array to copy values to.
   * @returns {Array} Returns `array`.
   */
  function arrayCopy(source, array) {
    var index = -1,
        length = source.length;

    array || (array = Array(length));
    while (++index < length) {
      array[index] = source[index];
    }
    return array;
  }

  return arrayCopy;
});

define('lodash-amd/modern/internal/baseForIn',['./baseFor', '../object/keysIn'], function(baseFor, keysIn) {

  /**
   * The base implementation of `_.forIn` without support for callback
   * shorthands and `this` binding.
   *
   * @private
   * @param {Object} object The object to iterate over.
   * @param {Function} iteratee The function invoked per iteration.
   * @returns {Object} Returns `object`.
   */
  function baseForIn(object, iteratee) {
    return baseFor(object, iteratee, keysIn);
  }

  return baseForIn;
});

define('lodash-amd/modern/internal/shimIsPlainObject',['./baseForIn', './isObjectLike'], function(baseForIn, isObjectLike) {

  /** `Object#toString` result references. */
  var objectTag = '[object Object]';

  /** Used for native method references. */
  var objectProto = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty = objectProto.hasOwnProperty;

  /**
   * Used to resolve the `toStringTag` of values.
   * See the [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-object.prototype.tostring)
   * for more details.
   */
  var objToString = objectProto.toString;

  /**
   * A fallback implementation of `_.isPlainObject` which checks if `value`
   * is an object created by the `Object` constructor or has a `[[Prototype]]`
   * of `null`.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
   */
  function shimIsPlainObject(value) {
    var Ctor;

    // Exit early for non `Object` objects.
    if (!(isObjectLike(value) && objToString.call(value) == objectTag) ||
        (!hasOwnProperty.call(value, 'constructor') &&
          (Ctor = value.constructor, typeof Ctor == 'function' && !(Ctor instanceof Ctor)))) {
      return false;
    }
    // IE < 9 iterates inherited properties before own properties. If the first
    // iterated property is an object's own property then there are no inherited
    // enumerable properties.
    var result;
    // In most environments an object's own properties are iterated before
    // its inherited properties. If the last iterated property is an object's
    // own property then there are no inherited enumerable properties.
    baseForIn(value, function(subValue, key) {
      result = key;
    });
    return typeof result == 'undefined' || hasOwnProperty.call(value, result);
  }

  return shimIsPlainObject;
});

define('lodash-amd/modern/lang/isPlainObject',['./isNative', '../internal/shimIsPlainObject'], function(isNative, shimIsPlainObject) {

  /** `Object#toString` result references. */
  var objectTag = '[object Object]';

  /** Used for native method references. */
  var objectProto = Object.prototype;

  /**
   * Used to resolve the `toStringTag` of values.
   * See the [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-object.prototype.tostring)
   * for more details.
   */
  var objToString = objectProto.toString;

  /** Native method references. */
  var getPrototypeOf = isNative(getPrototypeOf = Object.getPrototypeOf) && getPrototypeOf;

  /**
   * Checks if `value` is a plain object, that is, an object created by the
   * `Object` constructor or one with a `[[Prototype]]` of `null`.
   *
   * **Note:** This method assumes objects created by the `Object` constructor
   * have no inherited enumerable properties.
   *
   * @static
   * @memberOf _
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
   * @example
   *
   * function Foo() {
   *   this.a = 1;
   * }
   *
   * _.isPlainObject(new Foo);
   * // => false
   *
   * _.isPlainObject([1, 2, 3]);
   * // => false
   *
   * _.isPlainObject({ 'x': 0, 'y': 0 });
   * // => true
   *
   * _.isPlainObject(Object.create(null));
   * // => true
   */
  var isPlainObject = !getPrototypeOf ? shimIsPlainObject : function(value) {
    if (!(value && objToString.call(value) == objectTag)) {
      return false;
    }
    var valueOf = value.valueOf,
        objProto = isNative(valueOf) && (objProto = getPrototypeOf(valueOf)) && getPrototypeOf(objProto);

    return objProto
      ? (value == objProto || getPrototypeOf(value) == objProto)
      : shimIsPlainObject(value);
  };

  return isPlainObject;
});

define('lodash-amd/modern/lang/isTypedArray',['../internal/isLength', '../internal/isObjectLike'], function(isLength, isObjectLike) {

  /** `Object#toString` result references. */
  var argsTag = '[object Arguments]',
      arrayTag = '[object Array]',
      boolTag = '[object Boolean]',
      dateTag = '[object Date]',
      errorTag = '[object Error]',
      funcTag = '[object Function]',
      mapTag = '[object Map]',
      numberTag = '[object Number]',
      objectTag = '[object Object]',
      regexpTag = '[object RegExp]',
      setTag = '[object Set]',
      stringTag = '[object String]',
      weakMapTag = '[object WeakMap]';

  var arrayBufferTag = '[object ArrayBuffer]',
      float32Tag = '[object Float32Array]',
      float64Tag = '[object Float64Array]',
      int8Tag = '[object Int8Array]',
      int16Tag = '[object Int16Array]',
      int32Tag = '[object Int32Array]',
      uint8Tag = '[object Uint8Array]',
      uint8ClampedTag = '[object Uint8ClampedArray]',
      uint16Tag = '[object Uint16Array]',
      uint32Tag = '[object Uint32Array]';

  /** Used to identify `toStringTag` values of typed arrays. */
  var typedArrayTags = {};
  typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
  typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
  typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
  typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
  typedArrayTags[uint32Tag] = true;
  typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
  typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
  typedArrayTags[dateTag] = typedArrayTags[errorTag] =
  typedArrayTags[funcTag] = typedArrayTags[mapTag] =
  typedArrayTags[numberTag] = typedArrayTags[objectTag] =
  typedArrayTags[regexpTag] = typedArrayTags[setTag] =
  typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;

  /** Used for native method references. */
  var objectProto = Object.prototype;

  /**
   * Used to resolve the `toStringTag` of values.
   * See the [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-object.prototype.tostring)
   * for more details.
   */
  var objToString = objectProto.toString;

  /**
   * Checks if `value` is classified as a typed array.
   *
   * @static
   * @memberOf _
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
   * @example
   *
   * _.isTypedArray(new Uint8Array);
   * // => true
   *
   * _.isTypedArray([]);
   * // => false
   */
  function isTypedArray(value) {
    return (isObjectLike(value) && isLength(value.length) && typedArrayTags[objToString.call(value)]) || false;
  }

  return isTypedArray;
});

define('lodash-amd/modern/internal/baseCopy',[], function() {

  /**
   * Copies the properties of `source` to `object`.
   *
   * @private
   * @param {Object} source The object to copy properties from.
   * @param {Object} [object={}] The object to copy properties to.
   * @param {Array} props The property names to copy.
   * @returns {Object} Returns `object`.
   */
  function baseCopy(source, object, props) {
    if (!props) {
      props = object;
      object = {};
    }
    var index = -1,
        length = props.length;

    while (++index < length) {
      var key = props[index];
      object[key] = source[key];
    }
    return object;
  }

  return baseCopy;
});

define('lodash-amd/modern/lang/toPlainObject',['../internal/baseCopy', '../object/keysIn'], function(baseCopy, keysIn) {

  /**
   * Converts `value` to a plain object flattening inherited enumerable
   * properties of `value` to own properties of the plain object.
   *
   * @static
   * @memberOf _
   * @category Lang
   * @param {*} value The value to convert.
   * @returns {Object} Returns the converted plain object.
   * @example
   *
   * function Foo() {
   *   this.b = 2;
   * }
   *
   * Foo.prototype.c = 3;
   *
   * _.assign({ 'a': 1 }, new Foo);
   * // => { 'a': 1, 'b': 2 }
   *
   * _.assign({ 'a': 1 }, _.toPlainObject(new Foo));
   * // => { 'a': 1, 'b': 2, 'c': 3 }
   */
  function toPlainObject(value) {
    return baseCopy(value, keysIn(value));
  }

  return toPlainObject;
});

define('lodash-amd/modern/internal/baseMergeDeep',['./arrayCopy', '../lang/isArguments', '../lang/isArray', './isLength', '../lang/isPlainObject', '../lang/isTypedArray', '../lang/toPlainObject'], function(arrayCopy, isArguments, isArray, isLength, isPlainObject, isTypedArray, toPlainObject) {

  /** Used as a safe reference for `undefined` in pre-ES5 environments. */
  var undefined;

  /**
   * A specialized version of `baseMerge` for arrays and objects which performs
   * deep merges and tracks traversed objects enabling objects with circular
   * references to be merged.
   *
   * @private
   * @param {Object} object The destination object.
   * @param {Object} source The source object.
   * @param {string} key The key of the value to merge.
   * @param {Function} mergeFunc The function to merge values.
   * @param {Function} [customizer] The function to customize merging properties.
   * @param {Array} [stackA=[]] Tracks traversed source objects.
   * @param {Array} [stackB=[]] Associates values with source counterparts.
   * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
   */
  function baseMergeDeep(object, source, key, mergeFunc, customizer, stackA, stackB) {
    var length = stackA.length,
        srcValue = source[key];

    while (length--) {
      if (stackA[length] == srcValue) {
        object[key] = stackB[length];
        return;
      }
    }
    var value = object[key],
        result = customizer ? customizer(value, srcValue, key, object, source) : undefined,
        isCommon = typeof result == 'undefined';

    if (isCommon) {
      result = srcValue;
      if (isLength(srcValue.length) && (isArray(srcValue) || isTypedArray(srcValue))) {
        result = isArray(value)
          ? value
          : (value ? arrayCopy(value) : []);
      }
      else if (isPlainObject(srcValue) || isArguments(srcValue)) {
        result = isArguments(value)
          ? toPlainObject(value)
          : (isPlainObject(value) ? value : {});
      }
      else {
        isCommon = false;
      }
    }
    // Add the source value to the stack of traversed objects and associate
    // it with its merged value.
    stackA.push(srcValue);
    stackB.push(result);

    if (isCommon) {
      // Recursively merge objects and arrays (susceptible to call stack limits).
      object[key] = mergeFunc(result, srcValue, customizer, stackA, stackB);
    } else if (result === result ? (result !== value) : (value === value)) {
      object[key] = result;
    }
  }

  return baseMergeDeep;
});

define('lodash-amd/modern/internal/baseMerge',['./arrayEach', './baseForOwn', './baseMergeDeep', '../lang/isArray', './isLength', '../lang/isObject', './isObjectLike', '../lang/isTypedArray'], function(arrayEach, baseForOwn, baseMergeDeep, isArray, isLength, isObject, isObjectLike, isTypedArray) {

  /** Used as a safe reference for `undefined` in pre-ES5 environments. */
  var undefined;

  /**
   * The base implementation of `_.merge` without support for argument juggling,
   * multiple sources, and `this` binding `customizer` functions.
   *
   * @private
   * @param {Object} object The destination object.
   * @param {Object} source The source object.
   * @param {Function} [customizer] The function to customize merging properties.
   * @param {Array} [stackA=[]] Tracks traversed source objects.
   * @param {Array} [stackB=[]] Associates values with source counterparts.
   * @returns {Object} Returns the destination object.
   */
  function baseMerge(object, source, customizer, stackA, stackB) {
    if (!isObject(object)) {
      return object;
    }
    var isSrcArr = isLength(source.length) && (isArray(source) || isTypedArray(source));
    (isSrcArr ? arrayEach : baseForOwn)(source, function(srcValue, key, source) {
      if (isObjectLike(srcValue)) {
        stackA || (stackA = []);
        stackB || (stackB = []);
        return baseMergeDeep(object, source, key, baseMerge, customizer, stackA, stackB);
      }
      var value = object[key],
          result = customizer ? customizer(value, srcValue, key, object, source) : undefined,
          isCommon = typeof result == 'undefined';

      if (isCommon) {
        result = srcValue;
      }
      if ((isSrcArr || typeof result != 'undefined') &&
          (isCommon || (result === result ? (result !== value) : (value === value)))) {
        object[key] = result;
      }
    });
    return object;
  }

  return baseMerge;
});

define('lodash-amd/modern/utility/identity',[], function() {

  /**
   * This method returns the first argument provided to it.
   *
   * @static
   * @memberOf _
   * @category Utility
   * @param {*} value Any value.
   * @returns {*} Returns `value`.
   * @example
   *
   * var object = { 'user': 'fred' };
   *
   * _.identity(object) === object;
   * // => true
   */
  function identity(value) {
    return value;
  }

  return identity;
});

define('lodash-amd/modern/internal/bindCallback',['../utility/identity'], function(identity) {

  /**
   * A specialized version of `baseCallback` which only supports `this` binding
   * and specifying the number of arguments to provide to `func`.
   *
   * @private
   * @param {Function} func The function to bind.
   * @param {*} thisArg The `this` binding of `func`.
   * @param {number} [argCount] The number of arguments to provide to `func`.
   * @returns {Function} Returns the callback.
   */
  function bindCallback(func, thisArg, argCount) {
    if (typeof func != 'function') {
      return identity;
    }
    if (typeof thisArg == 'undefined') {
      return func;
    }
    switch (argCount) {
      case 1: return function(value) {
        return func.call(thisArg, value);
      };
      case 3: return function(value, index, collection) {
        return func.call(thisArg, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(thisArg, accumulator, value, index, collection);
      };
      case 5: return function(value, other, key, object, source) {
        return func.call(thisArg, value, other, key, object, source);
      };
    }
    return function() {
      return func.apply(thisArg, arguments);
    };
  }

  return bindCallback;
});

define('lodash-amd/modern/internal/isIterateeCall',['./isIndex', './isLength', '../lang/isObject'], function(isIndex, isLength, isObject) {

  /**
   * Checks if the provided arguments are from an iteratee call.
   *
   * @private
   * @param {*} value The potential iteratee value argument.
   * @param {*} index The potential iteratee index or key argument.
   * @param {*} object The potential iteratee object argument.
   * @returns {boolean} Returns `true` if the arguments are from an iteratee call, else `false`.
   */
  function isIterateeCall(value, index, object) {
    if (!isObject(object)) {
      return false;
    }
    var type = typeof index;
    if (type == 'number') {
      var length = object.length,
          prereq = isLength(length) && isIndex(index, length);
    } else {
      prereq = type == 'string' && index in object;
    }
    if (prereq) {
      var other = object[index];
      return value === value ? (value === other) : (other !== other);
    }
    return false;
  }

  return isIterateeCall;
});

define('lodash-amd/modern/internal/createAssigner',['./bindCallback', './isIterateeCall'], function(bindCallback, isIterateeCall) {

  /**
   * Creates a function that assigns properties of source object(s) to a given
   * destination object.
   *
   * @private
   * @param {Function} assigner The function to assign values.
   * @returns {Function} Returns the new assigner function.
   */
  function createAssigner(assigner) {
    return function() {
      var args = arguments,
          length = args.length,
          object = args[0];

      if (length < 2 || object == null) {
        return object;
      }
      var customizer = args[length - 2],
          thisArg = args[length - 1],
          guard = args[3];

      if (length > 3 && typeof customizer == 'function') {
        customizer = bindCallback(customizer, thisArg, 5);
        length -= 2;
      } else {
        customizer = (length > 2 && typeof thisArg == 'function') ? thisArg : null;
        length -= (customizer ? 1 : 0);
      }
      if (guard && isIterateeCall(args[1], args[2], guard)) {
        customizer = length == 3 ? null : customizer;
        length = 2;
      }
      var index = 0;
      while (++index < length) {
        var source = args[index];
        if (source) {
          assigner(object, source, customizer);
        }
      }
      return object;
    };
  }

  return createAssigner;
});

define('lodash-amd/modern/object/merge',['../internal/baseMerge', '../internal/createAssigner'], function(baseMerge, createAssigner) {

  /**
   * Recursively merges own enumerable properties of the source object(s), that
   * don't resolve to `undefined` into the destination object. Subsequent sources
   * overwrite property assignments of previous sources. If `customizer` is
   * provided it is invoked to produce the merged values of the destination and
   * source properties. If `customizer` returns `undefined` merging is handled
   * by the method instead. The `customizer` is bound to `thisArg` and invoked
   * with five arguments; (objectValue, sourceValue, key, object, source).
   *
   * @static
   * @memberOf _
   * @category Object
   * @param {Object} object The destination object.
   * @param {...Object} [sources] The source objects.
   * @param {Function} [customizer] The function to customize merging properties.
   * @param {*} [thisArg] The `this` binding of `customizer`.
   * @returns {Object} Returns `object`.
   * @example
   *
   * var users = {
   *   'data': [{ 'user': 'barney' }, { 'user': 'fred' }]
   * };
   *
   * var ages = {
   *   'data': [{ 'age': 36 }, { 'age': 40 }]
   * };
   *
   * _.merge(users, ages);
   * // => { 'data': [{ 'user': 'barney', 'age': 36 }, { 'user': 'fred', 'age': 40 }] }
   *
   * // using a customizer callback
   * var object = {
   *   'fruits': ['apple'],
   *   'vegetables': ['beet']
   * };
   *
   * var other = {
   *   'fruits': ['banana'],
   *   'vegetables': ['carrot']
   * };
   *
   * _.merge(object, other, function(a, b) {
   *   if (_.isArray(a)) {
   *     return a.concat(b);
   *   }
   * });
   * // => { 'fruits': ['apple', 'banana'], 'vegetables': ['beet', 'carrot'] }
   */
  var merge = createAssigner(baseMerge);

  return merge;
});

define('lodash-amd/modern/internal/initCloneArray',[], function() {

  /** Used for native method references. */
  var objectProto = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty = objectProto.hasOwnProperty;

  /**
   * Initializes an array clone.
   *
   * @private
   * @param {Array} array The array to clone.
   * @returns {Array} Returns the initialized clone.
   */
  function initCloneArray(array) {
    var length = array.length,
        result = new array.constructor(length);

    // Add array properties assigned by `RegExp#exec`.
    if (length && typeof array[0] == 'string' && hasOwnProperty.call(array, 'index')) {
      result.index = array.index;
      result.input = array.input;
    }
    return result;
  }

  return initCloneArray;
});

define('lodash-amd/modern/utility/constant',[], function() {

  /**
   * Creates a function that returns `value`.
   *
   * @static
   * @memberOf _
   * @category Utility
   * @param {*} value The value to return from the new function.
   * @returns {Function} Returns the new function.
   * @example
   *
   * var object = { 'user': 'fred' };
   * var getter = _.constant(object);
   *
   * getter() === object;
   * // => true
   */
  function constant(value) {
    return function() {
      return value;
    };
  }

  return constant;
});

define('lodash-amd/modern/internal/bufferClone',['../utility/constant', '../lang/isNative', './root'], function(constant, isNative, root) {

  /** Native method references. */
  var ArrayBuffer = isNative(ArrayBuffer = root.ArrayBuffer) && ArrayBuffer,
      bufferSlice = isNative(bufferSlice = ArrayBuffer && new ArrayBuffer(0).slice) && bufferSlice,
      floor = Math.floor,
      Uint8Array = isNative(Uint8Array = root.Uint8Array) && Uint8Array;

  /** Used to clone array buffers. */
  var Float64Array = (function() {
    // Safari 5 errors when using an array buffer to initialize a typed array
    // where the array buffer's `byteLength` is not a multiple of the typed
    // array's `BYTES_PER_ELEMENT`.
    try {
      var func = isNative(func = root.Float64Array) && func,
          result = new func(new ArrayBuffer(10), 0, 1) && func;
    } catch(e) {}
    return result;
  }());

  /** Used as the size, in bytes, of each `Float64Array` element. */
  var FLOAT64_BYTES_PER_ELEMENT = Float64Array ? Float64Array.BYTES_PER_ELEMENT : 0;

  /**
   * Creates a clone of the given array buffer.
   *
   * @private
   * @param {ArrayBuffer} buffer The array buffer to clone.
   * @returns {ArrayBuffer} Returns the cloned array buffer.
   */
  function bufferClone(buffer) {
    return bufferSlice.call(buffer, 0);
  }
  if (!bufferSlice) {
    // PhantomJS has `ArrayBuffer` and `Uint8Array` but not `Float64Array`.
    bufferClone = !(ArrayBuffer && Uint8Array) ? constant(null) : function(buffer) {
      var byteLength = buffer.byteLength,
          floatLength = Float64Array ? floor(byteLength / FLOAT64_BYTES_PER_ELEMENT) : 0,
          offset = floatLength * FLOAT64_BYTES_PER_ELEMENT,
          result = new ArrayBuffer(byteLength);

      if (floatLength) {
        var view = new Float64Array(result, 0, floatLength);
        view.set(new Float64Array(buffer, 0, floatLength));
      }
      if (byteLength != offset) {
        view = new Uint8Array(result, offset);
        view.set(new Uint8Array(buffer, offset));
      }
      return result;
    };
  }

  return bufferClone;
});

define('lodash-amd/modern/internal/initCloneByTag',['./bufferClone'], function(bufferClone) {

  /** `Object#toString` result references. */
  var boolTag = '[object Boolean]',
      dateTag = '[object Date]',
      numberTag = '[object Number]',
      regexpTag = '[object RegExp]',
      stringTag = '[object String]';

  var arrayBufferTag = '[object ArrayBuffer]',
      float32Tag = '[object Float32Array]',
      float64Tag = '[object Float64Array]',
      int8Tag = '[object Int8Array]',
      int16Tag = '[object Int16Array]',
      int32Tag = '[object Int32Array]',
      uint8Tag = '[object Uint8Array]',
      uint8ClampedTag = '[object Uint8ClampedArray]',
      uint16Tag = '[object Uint16Array]',
      uint32Tag = '[object Uint32Array]';

  /** Used to match `RegExp` flags from their coerced string values. */
  var reFlags = /\w*$/;

  /**
   * Initializes an object clone based on its `toStringTag`.
   *
   * **Note:** This function only supports cloning values with tags of
   * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
   *
   *
   * @private
   * @param {Object} object The object to clone.
   * @param {string} tag The `toStringTag` of the object to clone.
   * @param {boolean} [isDeep] Specify a deep clone.
   * @returns {Object} Returns the initialized clone.
   */
  function initCloneByTag(object, tag, isDeep) {
    var Ctor = object.constructor;
    switch (tag) {
      case arrayBufferTag:
        return bufferClone(object);

      case boolTag:
      case dateTag:
        return new Ctor(+object);

      case float32Tag: case float64Tag:
      case int8Tag: case int16Tag: case int32Tag:
      case uint8Tag: case uint8ClampedTag: case uint16Tag: case uint32Tag:
        var buffer = object.buffer;
        return new Ctor(isDeep ? bufferClone(buffer) : buffer, object.byteOffset, object.length);

      case numberTag:
      case stringTag:
        return new Ctor(object);

      case regexpTag:
        var result = new Ctor(object.source, reFlags.exec(object));
        result.lastIndex = object.lastIndex;
    }
    return result;
  }

  return initCloneByTag;
});

define('lodash-amd/modern/internal/initCloneObject',[], function() {

  /**
   * Initializes an object clone.
   *
   * @private
   * @param {Object} object The object to clone.
   * @returns {Object} Returns the initialized clone.
   */
  function initCloneObject(object) {
    var Ctor = object.constructor;
    if (!(typeof Ctor == 'function' && Ctor instanceof Ctor)) {
      Ctor = Object;
    }
    return new Ctor;
  }

  return initCloneObject;
});

define('lodash-amd/modern/internal/baseClone',['./arrayCopy', './arrayEach', './baseCopy', './baseForOwn', './initCloneArray', './initCloneByTag', './initCloneObject', '../lang/isArray', '../lang/isObject', '../object/keys'], function(arrayCopy, arrayEach, baseCopy, baseForOwn, initCloneArray, initCloneByTag, initCloneObject, isArray, isObject, keys) {

  /** `Object#toString` result references. */
  var argsTag = '[object Arguments]',
      arrayTag = '[object Array]',
      boolTag = '[object Boolean]',
      dateTag = '[object Date]',
      errorTag = '[object Error]',
      funcTag = '[object Function]',
      mapTag = '[object Map]',
      numberTag = '[object Number]',
      objectTag = '[object Object]',
      regexpTag = '[object RegExp]',
      setTag = '[object Set]',
      stringTag = '[object String]',
      weakMapTag = '[object WeakMap]';

  var arrayBufferTag = '[object ArrayBuffer]',
      float32Tag = '[object Float32Array]',
      float64Tag = '[object Float64Array]',
      int8Tag = '[object Int8Array]',
      int16Tag = '[object Int16Array]',
      int32Tag = '[object Int32Array]',
      uint8Tag = '[object Uint8Array]',
      uint8ClampedTag = '[object Uint8ClampedArray]',
      uint16Tag = '[object Uint16Array]',
      uint32Tag = '[object Uint32Array]';

  /** Used to identify `toStringTag` values supported by `_.clone`. */
  var cloneableTags = {};
  cloneableTags[argsTag] = cloneableTags[arrayTag] =
  cloneableTags[arrayBufferTag] = cloneableTags[boolTag] =
  cloneableTags[dateTag] = cloneableTags[float32Tag] =
  cloneableTags[float64Tag] = cloneableTags[int8Tag] =
  cloneableTags[int16Tag] = cloneableTags[int32Tag] =
  cloneableTags[numberTag] = cloneableTags[objectTag] =
  cloneableTags[regexpTag] = cloneableTags[stringTag] =
  cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] =
  cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
  cloneableTags[errorTag] = cloneableTags[funcTag] =
  cloneableTags[mapTag] = cloneableTags[setTag] =
  cloneableTags[weakMapTag] = false;

  /** Used for native method references. */
  var objectProto = Object.prototype;

  /**
   * Used to resolve the `toStringTag` of values.
   * See the [ES spec](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-object.prototype.tostring)
   * for more details.
   */
  var objToString = objectProto.toString;

  /**
   * The base implementation of `_.clone` without support for argument juggling
   * and `this` binding `customizer` functions.
   *
   * @private
   * @param {*} value The value to clone.
   * @param {boolean} [isDeep] Specify a deep clone.
   * @param {Function} [customizer] The function to customize cloning values.
   * @param {string} [key] The key of `value`.
   * @param {Object} [object] The object `value` belongs to.
   * @param {Array} [stackA=[]] Tracks traversed source objects.
   * @param {Array} [stackB=[]] Associates clones with source counterparts.
   * @returns {*} Returns the cloned value.
   */
  function baseClone(value, isDeep, customizer, key, object, stackA, stackB) {
    var result;
    if (customizer) {
      result = object ? customizer(value, key, object) : customizer(value);
    }
    if (typeof result != 'undefined') {
      return result;
    }
    if (!isObject(value)) {
      return value;
    }
    var isArr = isArray(value);
    if (isArr) {
      result = initCloneArray(value);
      if (!isDeep) {
        return arrayCopy(value, result);
      }
    } else {
      var tag = objToString.call(value),
          isFunc = tag == funcTag;

      if (tag == objectTag || tag == argsTag || (isFunc && !object)) {
        result = initCloneObject(isFunc ? {} : value);
        if (!isDeep) {
          return baseCopy(value, result, keys(value));
        }
      } else {
        return cloneableTags[tag]
          ? initCloneByTag(value, tag, isDeep)
          : (object ? value : {});
      }
    }
    // Check for circular references and return corresponding clone.
    stackA || (stackA = []);
    stackB || (stackB = []);

    var length = stackA.length;
    while (length--) {
      if (stackA[length] == value) {
        return stackB[length];
      }
    }
    // Add the source value to the stack of traversed objects and associate it with its clone.
    stackA.push(value);
    stackB.push(result);

    // Recursively populate clone (susceptible to call stack limits).
    (isArr ? arrayEach : baseForOwn)(value, function(subValue, key) {
      result[key] = baseClone(subValue, isDeep, customizer, key, value, stackA, stackB);
    });
    return result;
  }

  return baseClone;
});

define('lodash-amd/modern/lang/cloneDeep',['../internal/baseClone', '../internal/bindCallback'], function(baseClone, bindCallback) {

  /**
   * Creates a deep clone of `value`. If `customizer` is provided it is invoked
   * to produce the cloned values. If `customizer` returns `undefined` cloning
   * is handled by the method instead. The `customizer` is bound to `thisArg`
   * and invoked with two argument; (value [, index|key, object]).
   *
   * **Note:** This method is loosely based on the structured clone algorithm.
   * The enumerable properties of `arguments` objects and objects created by
   * constructors other than `Object` are cloned to plain `Object` objects. An
   * empty object is returned for uncloneable values such as functions, DOM nodes,
   * Maps, Sets, and WeakMaps. See the [HTML5 specification](http://www.w3.org/TR/html5/infrastructure.html#internal-structured-cloning-algorithm)
   * for more details.
   *
   * @static
   * @memberOf _
   * @category Lang
   * @param {*} value The value to deep clone.
   * @param {Function} [customizer] The function to customize cloning values.
   * @param {*} [thisArg] The `this` binding of `customizer`.
   * @returns {*} Returns the deep cloned value.
   * @example
   *
   * var users = [
   *   { 'user': 'barney' },
   *   { 'user': 'fred' }
   * ];
   *
   * var deep = _.cloneDeep(users);
   * deep[0] === users[0];
   * // => false
   *
   * // using a customizer callback
   * var el = _.cloneDeep(document.body, function(value) {
   *   if (_.isElement(value)) {
   *     return value.cloneNode(true);
   *   }
   * });
   *
   * el === document.body
   * // => false
   * el.nodeName
   * // => BODY
   * el.childNodes.length;
   * // => 20
   */
  function cloneDeep(value, customizer, thisArg) {
    customizer = typeof customizer == 'function' && bindCallback(customizer, thisArg, 1);
    return baseClone(value, true, customizer);
  }

  return cloneDeep;
});

define('scribe-plugin-sanitizer',[
  'html-janitor',
  'lodash-amd/modern/object/merge',
  'lodash-amd/modern/lang/cloneDeep'
], function (
  HTMLJanitor,
  merge,
  cloneDeep
) {

  /**
   * This plugin adds the ability to sanitize content when it is pasted into the
   * scribe, adhering to a whitelist of allowed tags and attributes.
   */

  

  return function (config) {
    // We extend the config to let through (1) Scribe position markers,
    // otherwise we lose the caret position when running the Scribe content
    // through this sanitizer, and (2) BR elements which are needed by the
    // browser to ensure elements are selectable.
    var configAllowMarkers = merge(cloneDeep(config), {
      tags: {
        em: {class: 'scribe-marker'},
        br: {}
      }
    });

    return function (scribe) {
      var janitor = new HTMLJanitor(configAllowMarkers);

      scribe.registerHTMLFormatter('sanitize', janitor.clean.bind(janitor));
    };
  };

});


//# sourceMappingURL=scribe-plugin-sanitizer.js.map;
define('ImageServiceAttribute',['scribe', 'scribe-plugin-toolbar', 'scribe-plugin-cn-link-create', 'scribe-plugin-sanitizer'], function (Scribe, ScribePluginToolbar, CnLinkCreate, ScribePluginSanitizer) {

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
         * The Field is ready and initialized
         * @type {boolean}
         */
        that.initialized = false;

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
            var bootstrapContainer = $('<div class="col-xs-12 col-sm-9 col-md-9 no-drag" ></div>');
            var select = $('<select data-name="' + fieldName + '" multiple ></select>');

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

            that.initialized = true;

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
                    '<div class="col-xs-12 col-sm-9 col-md-9 field-container no-drag" ></div>' +
                '</li>');

            var select = $('<selectdata-name="' + fieldName + '"></select>');
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

            that.initialized = true;
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

            var container = $('<li class="row"><label class="col-xs-12 col-sm-3 col-md-3" for="' + fieldName + '">' + fieldLabel + '</label><div class="col-xs-12 col-sm-9 col-md-9 no-drag" ><input type="checkbox"data-name="' + fieldName + '" value=""></div></li>');

            container.find('checkbox').val(fieldValue);
            container.find('checkbox').attr('value', fieldValue);
            
            container.on('click', function (event) {
                that.value = event.target.checked ? checkboxValue : '';
            });

            if (fieldValue == checkboxValue) {
                container.find('input').attr('checked', 'checked').prop('checked', true);
            }

            that.initialized = true;
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

            var container = $('<li class="row"><label class="col-xs-12 col-sm-3 col-md-3" for="' + fieldName + '">' + fieldLabel + '</label><div class="col-xs-12 col-sm-9 col-md-9 no-drag" ><input type="text"data-name="' + fieldName + '" value=""></div></li>');

            container.find('input').val(fieldValue);
            container.find('input').attr('value', fieldValue);

            container.on('change', function (event) {
                that.value = $(event.target).val();
            });

            that.initialized = true;
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

            var container = $('<li class="row">' +
                '<label class="col-xs-12 col-sm-3 col-md-3" for="' + fieldName + '">' + fieldLabel + '</label>' +
                '<div class="col-xs-12 col-sm-9 col-md-9">' +
                '<div class="toolbar no-drag">  ' +
                '<button data-command-name="bold"         type="button"><strong>Aa</strong></button>' +
                '<button data-command-name="italic"       type="button"><i>Aa</i></button>' +
                '<button data-command-name="cnCreateLink" type="button"><i class="fa fa-link" aria-hidden="true"></i></button>' +
                '</div>' +
                '<div contenteditable="true" class="no-drag imageservice-scribe" >' + fieldValue + '</div>' +
                '</div>' +
                '</li>');

            container.find('.toolbar').hide();

            window.document.addEventListener("selectionchange", function (event, data) {
                var selection = window.getSelection();
                var element   = $(event.srcElement.activeElement);

                if (selection.isCollapsed)
                    element.siblings('.toolbar').hide();
                else
                    element.siblings('.toolbar').show();
            });

            container.on(Events.ATTRIBUTERENDERED, function (event, data) {

                // Use some plugins
                var toolbarElement = data.container.find('.toolbar')[0];
                var editorElement = data.container.find('.imageservice-scribe:first')[0];

                var scribe = new Scribe(editorElement);

                scribe.allowsBlockElements();
                scribe.setContent(fieldValue);

                scribe.use(ScribePluginToolbar(toolbarElement));
                scribe.use(CnLinkCreate());
                scribe.use(ScribePluginSanitizer(
                    {
                        tags: {
                            p: {},
                            b: {},
                            i: {},
                            br: {},
                            a: {
                                href: true,
                                target: '_blank',
                                rel: true
                            }
                        }
                    }));

                // transfer the change to the attribute store
                scribe.on('content-changed', function () {

                    var oldValue = that.value;
                    that.value = scribe.getHTML();

                    if(oldValue != scribe.getHTML())
                        container.trigger('change');

                });

                that.initialized = true;

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

            that.container = $('<ul class="imageservice-attributes"></ul>');

            that.attributes.forEach(function (el, index) {
                that.container.append(el.render());
                el.trigger(Events.ATTRIBUTERENDERED, el);
            });

            return that.container;
        };

        that.init();
    }
});
define('ImageServiceSirTrevor',['ImageServiceConfig'],function(ImageServiceConfig){

    return  function(options) {
        var that = this;
        var extensionUrl = options.extensionUrl;
        var serviceName = options.serviceName;
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
                $(this.$('.data-target')).text(JSON.stringify(data));

            },

            /**
             * Sets the data form the ImageService into the Block store
             */
            save: function(){

                if(!this.imageServiceInstance)
                    return;

                var listData = this.imageServiceInstance.list.getData();
                var settingsData = this.imageServiceInstance.settings.getData();

                this.setData(Object.assign({}, settingsData, {items: listData.items}));

            },

            /**
             * Creates the new image service block
             */
            onBlockRender: function() {

                // Gives the container an unique id
                $(this.$('.frontend-target')).attr('id', 'ImageService' + String(new Date().valueOf()));

                var config = SirTrevor.getInstance(this.instanceID).options.options.Imageservice || {};
                // Merges the Field config with the defaults
                var defaults = {
                    dataElement: this.$('.data-target'),
                    hostElement: this.$('.frontend-target'),
                    serviceUrl: extensionUrl + '/image',
                    serviceName: config.service || serviceName
                };

                // Inits the Image Service
                var customInstance = new ImageServiceModel(Object.assign(config, defaults ));

                this.imageServiceInstance = customInstance;
            },

            /**
             * Remove the ImageService Block from saving
             * @param e
             */
            onDeleteConfirm: function(e) {
                e.preventDefault();
                $(document).trigger( ImageServiceConfig.events.LISTREMOVED, { instance: this.imageServiceInstance });
                this.mediator.trigger('block:remove', this.blockID, {focusOnPrevious: true});
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






var CnImageServiceBackendConfig = {
   baseUrl: document.currentScript.getAttribute('data-extension-url'),
   defaultServiceName: document.currentScript.getAttribute('data-default-servicename')
};

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
], function (ImageServiceAttributesFactory,
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

    window.CnImageService = function (data) {
        // ------ Factory --------

        var that = this;
        /**
         * Filed Holding the generated JSON
         * @type {jQuery|HTMLElement}
         */
        that.store = $(data.dataElement);
        that.storeJson = JSON.parse(that.store.val());

        /**
         * Host HTML Element holding all new generated elements
         * Also used as an Event-Arena
         * @type {jQuery|HTMLElement}
         */
        that.host = $(data.hostElement);

        that.errors = new ImageServiceErrors(data.errors);
        that.config = ImageServiceConfig;

        /**
         * Backend connector
         * @type {ImageServiceConnector}
         */
        that.service = new ImageServiceConnector({
            defaults: data.cache,
            baseUrl: data.serviceUrl,
            serviceName: data.serviceName,
            factory: {
                errors: that.errors
            }
        });

        /**
         * Constructor
         */
        that.init = function () {
            that.host.addClass('imageservice-container');
            that.store.hide();
            $(document).trigger(ImageServiceConfig.events.LISTREADY, { instance: that });
        };

        that.modelFactory = new ImageServiceImageModelFactory({
            host: that.host,
            config: that.config,
            defaults: {
                service: data.serviceName
            }
        });

        that.attributesFactory = new ImageServiceAttributesFactory({
            attribute: ImageServiceAttribute,
            events: that.config.events,
            model: ImageServiceAttributes
        });

        that.listItemFactory = new ImageServiceListItemFactory({
            model: ImageServiceListItem,
            events: that.config.events,
            eventsArena: that.host,
            actions: ImageServiceEntityAction,
            preview: ImageServicePreview,
            attributes: that.attributesFactory,
            dataModel: that.modelFactory,
            config: that.config,
            service: that.service,
            definitions: {
                attributes: Object.assign(
                    {},
                    data.attributes, that.config.systemAttributes
                )
            }
        });

        /**
         * Uploader of items
         * @type {ImageServiceUploader}
         */
        that.uploader = new ImageServiceUploader({
            host: that.host,
            maxFileSize: data.maxFileSize,
            service: that.service,
            config: {
                events: that.config.events,
                labels: that.config.labels.ImageServiceUploader
            },
            factory: {
                model: that.modelFactory
            }
        });

        /**
         * Finds images on the rmeote service and adds them to the list
         * @type {ImageServiceFinder}
         */
        that.finder = new ImageServiceFinder({
            host: that.host,
            service: that.service,
            config: {
                events: that.config.events,
                labels: that.config.labels.ImageServiceFinder
            }
        });

        that.settings = new ImageServiceSettings({
            host: that.host,
            config: {
                events: that.config.events,
                labels: that.config.labels.ImageServiceSettings
            },
            data: that.storeJson
        });

        /**
         * Global settings concerning the instance
         */
        if (Object.keys(data.globals || {}).length)
            that.globals = new ImageServiceGlobals({
                host: that.host,
                parentContainer: null,
                attributes: data.globals,
                service: that.service,
                prefix: 'globals',
                config: {
                    events: that.config.events,
                    labels: that.config.labels.ImageServiceGlobals
                },
                values: {},
                factory: {
                    attributes: that.attributesFactory
                }
            });

        /**
         * Presets of the Image attributes
         */
        if (Object.keys(data.attributes || {}).length)
            that.presets = new ImageServicePresets({
                host: that.host,
                parentContainer: null,
                attributes: jQuery.extend({}, data.attributes, that.config.systemAttributes),
                service: that.service,
                prefix: 'presets',
                config: {
                    events: that.config.events,
                    labels: that.config.labels.ImageServicePresets
                },
                values: {},
                factory: {
                    attributes: that.attributesFactory
                }
            });

        /**
         * Massage UI
         * @type {ImageServiceMessaging}
         */
        that.messaging = new ImageServiceMessaging({
            host: that.host,
            events: {
                error: that.config.events.MESSAGEERROR,
                warning: that.config.events.MESSAGEWARNING,
                info: that.config.events.MESSAGEINFO
            }
        });

        /**
         * List of items
         * @type {ImageServiceList}
         */
        that.list = new ImageServiceList({
            hostElement: that.host,
            items: JSON.parse(that.store.val()),
            maxItems: data.maxFiles || null,
            config: {
                events: that.config.events
            },
            factory: {
                listItem: that.listItemFactory,
                model: that.modelFactory
            }
        });

        that.updateStore = function(value) {

            try{

                that.storeJson = value;
                // transforms the response to json for the backend-save
                var serialized = JSON.stringify(value);

                $(that.store).val(serialized);

                // Update a textarea
                if( $(that.store).prop("tagName") == 'TEXTAREA' )
                    $(that.store).html(serialized)

                // informs the host that the list has been saved
                $(that.host).trigger(that.config.events.LISTSAVED, value);

            } catch (error) {
                $(that.host).trigger(that.config.events.LISTSAVEFAILED, {error: error});
            }

        };

        /**
         * Checks of the list has changed
         */
        that.needsSaving = function() {
            return that.list.dirty;
        };

        /**
         * Action that have to be executed on save. It modifies the event in order to
         * make sure that the ajax call has finished before the actual saving takes place.
         * This set of actions have to happen first.
         * @param event
         * @returns {*}
         */
        that.save = function (event) {

            if (that.list.dirty) {
                // Stop the initial save process - syncronious save
                event = event || new Event(that.config.events.LISTSAVED);
                event.preventDefault();
                event.stopImmediatePropagation();

                // Gets the current list data
                var data = that.list.getData();

                // Invokes the Backend-Connector Save
                that.service.imageSave({
                    async: false, // unfortunately, this functionality is deprecated
                    items: data.items,
                    files: data.files,

                    // Updates the JSON-holding element and recalls the save event
                    callback: function (newItems) {

                        var settings = that.settings.getData();

                        that.updateStore(Object.assign({}, settings, {items: newItems}));

                    },

                    // Warning handler, the saving process is not cancelled!
                    warning: function (messages, items) {
                        var result = true;
                        messages.forEach(function (message) {
                            result = result && that.processWarning(message, {items: items});
                        });
                        return result;
                    },

                    // Error handler, the saving process is cancelled
                    error: function (error) {
                        that.processError(error, data)
                    }
                });
            } else {
                $(that.host).trigger(that.config.events.LISTSAVINGSKIPPED, that.storeJson );
            }

        };

        /**
         *
         * @param warning
         * @param data
         * @returns {boolean}
         */
        that.processWarning = function(warning, data) {
            console.warn(warning);
            var result = true;
            var message = that.errors.create(warning.code) + ' - ' + warning.id;

            if (warning.type === "warn")
                that.host.trigger(
                    that.config.events.MESSAGEWARNING,
                    {error: message,  data: warning }
                );
            else if(warning.type==="error")
                result = that.processError(message,  warning );

            return result;
        };

        /**
         *
         * @param error
         * @param data
         * @returns {boolean}
         */
        that.processError = function(error, data) {
            console.warn(error);

            that.host.trigger(that.config.events.MESSAGEERROR, {error: error, data: data});
            $(that.host).trigger(that.config.events.LISTSAVEFAILED, {error: error, data: data});

            return false;
        };

        that.init();
    };

    // Makes sure that the current script is available as a function
    $(document).currentScript = document.currentScript || (function() {
            var scripts = document.getElementsByTagName('script');
            return scripts[scripts.length - 1];
    })();

    var cnImageServiceST = new ImageServiceSirTrevor({
        extensionUrl: CnImageServiceBackendConfig.baseUrl,
        serviceName: CnImageServiceBackendConfig.defaultServiceName,
        model: {
            imageService: CnImageService
        }
    });

    $(document).on('SirTrevor.DynamicBlock.All', function () {
        $(document).trigger('SirTrevor.DynamicBlock.Add', [cnImageServiceST]);
    });

    $(document).trigger('SirTrevor.DynamicBlock.Add', [cnImageServiceST]);

});
define("CnImageService", function(){});

var CnImageServiceBolt = {};
require(['ImageServiceConfig',
        'ImageServicePreview',
        'ImageServiceImageModelFactory',
        'ImageServiceMessaging',
        'ImageServiceUniqueId'
    ],
    function (ImageServiceConfig, ImageServicePreview, ImageServiceImageModelFactory, ImageServiceMessaging, ImageServiceUniqueId) {

        CnImageServiceBolt = new (function () {

            var that = this;
            var instances = [];
            var saved = 0;
            var failed = 0;
            var lastEvent = null;
            var loader = '<div class="imageservice-saving">Saving Images</div>';
            var collections = [];
            var messaging = null;

            var idGenerator = new ImageServiceUniqueId('');
            var modal = $('<div class="buic-modal modal fade imageservice-progress" tabindex="-1" role="dialog" aria-labelledby="imageservice-progress">\n' +
                '  <div class="modal-dialog modal-lg" role="document">\n' +
                '     <div class="modal-content">' +
                '         <div class="modal-header"><h2 class="hide-on-error">Saving Images</h2><h2 class="show-on-error error">Saving Cancelled</h2></div>' +
                '         <div class="modal-body"></div>\n' +
                '         <div class="modal-footer show-on-error">' +
                '             <div class=\"error col-xs-12 col-md-8\">An error occured. Please remove or change the images marked with red and try again.</div>' +
                '             <div class=\"col-xs-12 col-md-4\"><button type="button" class="btn btn-default pull-right" data-dismiss="modal">Close</button></div>' +
                '         </div>\n' +
                '     </div>'+
                '  </div>\n' +
                '</div>\n');

            $('body').append(modal);

            // Listenes for saved events of the Instances, and when all are saved, fieres the save event of the original save button
            // The CnImageService Compoenent fires different events on list saved, or the list does not need saving
            $(document).on( ImageServiceConfig.events.LISTSAVED + ' '
                          + ImageServiceConfig.events.LISTSAVINGSKIPPED + ' '
                          //+ ImageServiceConfig.events.MESSAGEWARNING + ' '
                          + ImageServiceConfig.events.LISTSAVEFAILED ,
                function (event, data) {

                    if(event.type === ImageServiceConfig.events.LISTSAVEFAILED) {

                        failed++;

                        //messaging.error(data.error || 'Unknown error occurred');

                        // Process unsaved images
                        if (data.hasOwnProperty('data') && data.data instanceof Array) {
                            that.savedError(data.data);
                        }

                    } else {
                        saved--;
                        that.savedHide(data.items);
                    }

                    if (saved === 0)
                        that.finishSaving(true);
                    else if (saved - failed === 0 )
                        that.finishSaving(false);

                }
            );

            $(document).on( ImageServiceConfig.events.MESSAGEWARNING + ' ' +  ImageServiceConfig.events.MESSAGEERROR,
                function (event, warning) {
                    modal.find('img[id="'+warning.data.id+'"]').parent().addClass('error');
            });

            // Listens for new ImageServiceFields register
            $(document).on(ImageServiceConfig.events.LISTREADY, function (event, data) {
                instances.push(data.instance);
            });

            // Listens for new ImageServiceFields remove
            $(document).on(ImageServiceConfig.events.LISTREMOVED, function (event, data) {
                var index = instances.indexOf(data.instance);
                console.log(instances.indexOf(data.instance));
                if(index>-1)
                    instances.splice(index,1);
            });

            // Clones the save button to makes sure that we save the imageservice fields first
            $(window).on('load', function(){
                $('#sidebarsavecontinuebutton, #savecontinuebutton, #sidebarpreviewbutton, #previewbutton').each(function(el){

                    var customButton = $($(this).prop('outerHTML'));

                    customButton.data('parentButton', $(this));
                    customButton.attr('id', customButton.attr('id') + '-imageservice');
                    customButton.insertBefore($(this));
                    customButton.on('click', function(event){
                        event.stopPropagation();
                        event.preventDefault();
                        that.save(event); //customButton.data('parentButton').trigger('click');
                    });
                    $(this).hide();

                    $(loader).insertBefore(customButton);
                    $('.imageservice-saving').hide();

                });
            });

            /**
             *
             */
            that.finishSaving = function(successfull) {

                if(successfull) {
                    modal.modal('hide');
                    if(typeof($(lastEvent.target).data('parentButton')) !== 'undefined')
                        $(lastEvent.target).data('parentButton').trigger(lastEvent.type, {
                            imageserviceskip: true
                        });
                } else {
                    that.savedError([]);
                    modal.find('.show-on-error').show();
                    modal.find('.hide-on-error').hide();
                }

                $('.imageservice-saving').hide();
            };



            /**
             * Calls all the instances and saves the data to the wished store
             * @param event
             * @param data
             */
            that.save = function (event, data) {

                $('.imageservice-saving').show();
                $('.imageservice-saving-progress-modal').html('');

                var needsSaving = false;
                collections = [];

                lastEvent = event;
                saved = instances.length;
                failed = 0;

                // Gets the Data to save
                instances.forEach(function (instance) {
                    if(instance.needsSaving()){
                        collections.push(instance.list.getData().items);
                        needsSaving = true;
                    }
                });

                if(needsSaving) {
                    // Shows the Progress Modal
                    that.showProgress();

                    // Trigger Saving
                    instances.forEach(function (instance) {
                        instance.save();
                    });
                } else {
                    that.finishSaving(true);
                }

            };

            /**
             * Hide the saved images
             * @param list
             */
            that.savedHide = function(list) {
                list.forEach(function(item){
                    $('.modal-body').find('img[id="'+idGenerator.generate(item.id)+'"]').parent().hide();
                })
            };

            /**
             * Do things on error on saving
             * @param list
             */
            that.savedError = function(list) {

                if(!list.length) {
                    $('.modal-body img').removeClass('saving');
                    //$('.modal-body img').addClass('error');
                    return;
                }

                list.forEach(function(item){
                    $('.imageservice-saving-progress-modal').find('img[id="'+idGenerator.generate(item.id)+'"]').each(function(){
                        $(this).removeClass('saving');
                        $(this).addClass('error');
                    });
                })
            };

            /**
             * Shows the Modal windows for the Progress
             */
            that.showProgress = function() {

                modal.find('.modal-body').html('');

                collections.forEach(function(collection){

                    collection.forEach(function(image){
                        var preview = new ImageServicePreview({
                            item: image,
                            config: {
                                events: ImageServiceConfig.events
                            },
                            factory: {
                                dataModel: ImageServiceImageModelFactory
                            }
                        });
                        var html = preview.render();
                        html.find('img').attr('style','-webkit-animation-duration: ' + (Math.random(7)+3) + 's');
                        html.find('img').addClass('saving');
                        modal.find('.modal-body').append(preview.render());
                    });
                });

                modal.find('.show-on-error').hide();
                modal.find('.hide-on-error').show();

                modal.modal({
                    show: true
                });

                /*messaging = new ImageServiceMessaging({
                    host: modal.find('.modal-body'),
                    events: ImageServiceConfig.events
                });*/

            }

        })();
    });

define("CnImageServiceBolt", function(){});

}());
