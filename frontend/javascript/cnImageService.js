
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
                    labels: that.config.labels.ImageServicePresets,
                    systemAttributes: that.config.systemAttributes
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
                $(that.host).trigger(that.config.events.LISTSAVINGSKIPPED, that.storeJson || [] );
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