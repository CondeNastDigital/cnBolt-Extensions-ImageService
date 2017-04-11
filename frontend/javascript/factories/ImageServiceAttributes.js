define(function () {
    /**
     * Factory class for creating Attributes Componenets
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