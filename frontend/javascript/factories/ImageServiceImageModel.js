/**
 * Created by ralev on 05.04.17.
 */
define(function() {

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
         * Initiaation
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