/**
 * Created by ralev on 05.04.17.
 */
define(function () {

    return function(data) {
        var that = this;

        var Model = data.model;
        var Events = data.events;
        var Actions = data.actions;
        var Preview = data.preview;
        var Attributes = data.attributes;
        var DataModel = data.dataModel;

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
                        }
                    },
                    options
                )
            );
        };
    }
});