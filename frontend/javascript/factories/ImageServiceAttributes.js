define(function () {
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