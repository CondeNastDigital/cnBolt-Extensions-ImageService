define(function () {

    /**
     * Factory for creating a List Items (List Rows)
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