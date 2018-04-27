define(["ImageServiceUniqueId"],function (ImageServiceUniqueId) {

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
        var Config = data.config;

        var attributeDefinition = data.definitions.attributes;
        var service = data.service;

        that.create = function (options) {

            var idGenerator = new ImageServiceUniqueId(options.prefix);

            return new Model(
                Object.assign({
                        config: {
                            events: Events,
                            systemAttributes: Config.systemAttributes
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