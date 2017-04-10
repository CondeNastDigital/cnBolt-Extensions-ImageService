require.config({
    paths: {
        "ImageServiceAttributesFactory": "factories/ImageServiceAttributes",
        "ImageServiceImageModelFactory": "factories/ImageServiceImageModel",
        "ImageServiceListItemFactory": "factories/ImageServiceListItem",
        "ImageServiceConnector": "classes/ImageServiceConnector",
        "ImageServiceUploader": "classes/ImageServiceUploader",
        "ImageServiceSettings": "classes/ImageServiceSettings",
        "ImageServiceFinder": "classes/ImageServiceFinder",
        "ImageServicePresets": "classes/ImageServicePresets",
        "ImageServiceMessaging": "classes/ImageServiceMessaging",
        "ImageServiceList": "classes/ImageServiceList",
        "ImageServiceConfig": "classes/ImageServiceConfig",
        "ImageServiceErrors": "classes/ImageServiceErrors",
        "ImageServiceGlobals": "classes/ImageServiceGlobals",
        "ImageServiceListItem": "classes/ImageServiceListItem",
        "ImageServiceEntityAction": "classes/ImageServiceEntityActions",
        "ImageServicePreview": "classes/ImageServicePreview",
        "ImageServiceAttribute": "classes/ImageServiceAttribute",
        "ImageServiceAttributes": "classes/ImageServiceAttributes",
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
            config: config
        });


        /**
         * Backend connector
         * @type {ImageServiceConnector}
         */
        var service = new ImageServiceConnector({
            defaults: data.cache,
            basUrl: data.serviceUrl,
            factory: {
                errors: errors
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
            config: config,
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
            config: config
        });

        var settings = new ImageServiceSettings({
            host: host,
            config: config,
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
                config: config,
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
                attributes: data.attributes,
                service: service,
                config: config,
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
            messages: {
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
            service: service,
            hostElement: host,
            items: JSON.parse(store.val()),
            attributes: Object.assign({}, data.attributes, config.systemAttributes),
            maxItems: data.maxFiles || null,
            config: config,
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
                        store.val(JSON.stringify({items: newItems}));
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
                                ImageServiceErrors[message.code] + ' - ' + message.id
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