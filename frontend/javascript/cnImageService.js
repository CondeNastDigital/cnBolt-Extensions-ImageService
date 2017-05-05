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
var defaultServiceName = document.currentScript.getAttribute('data-default-servicename');
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

    CnImageService = function (data) {
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
            data: that.storeJson.settings
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
                        var newData = {items: newItems, settings: that.settings.getData()};
                        // transforms the response to json for the backend-save
                        $(that.store).val(JSON.stringify(newData));
                        // informs the host that the list has been saved
                        $(that.host).trigger(that.config.events.LISTSAVED, newData);
                    },

                    // Warning handler, the saving process is not cancelled!
                    warning: function (messages) {
                        messages.forEach(function (message) {
                            console.warn(message);
                            that.host.trigger(
                                that.config.events.MESSAGEWARNING,
                                that.errors.create(message.code) + ' - ' + message.id
                            );
                        });
                    },

                    // Error handler, the saving process is cancelled
                    error: function (error) {
                        console.error(error);
                        that.host.trigger(that.config.events.MESSAGEERROR, error);
                    }
                });
            } else {
                $(that.host).trigger(that.config.events.LISTSAVINGSKIPPED, that.store );
            }

        };

        that.init();
    };

    // Makes sure that the current script is available as a function
    $(document).currentScript = document.currentScript || (function() {
            var scripts = document.getElementsByTagName('script');
            return scripts[scripts.length - 1];
    })();

    var cnImageServiceST = new ImageServiceSirTrevor({
        extensionUrl: baseUrl,
        serviceName: defaultServiceName,
        model: {
            imageService: CnImageService
        }
    });

    $(document).on('SirTrevor.DynamicBlock.All', function () {
        $(document).trigger('SirTrevor.DynamicBlock.Add', [cnImageServiceST]);
    });

    $(document).trigger('SirTrevor.DynamicBlock.Add', [cnImageServiceST]);

});