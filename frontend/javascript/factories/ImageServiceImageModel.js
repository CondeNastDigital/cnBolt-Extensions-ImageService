define(function() {

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