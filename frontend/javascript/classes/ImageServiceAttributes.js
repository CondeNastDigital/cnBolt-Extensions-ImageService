/**
 * Created by ralev on 05.04.17.
 */
define(function () {

    return function(data) {

        var that = this;
        var Attribute = data.model.attribute;
        var Events = data.config.events;

        that.values = data.values || [];
        that.prefix = data.prefix || '';
        that.definitions = data.definitions;
        that.attributes = [];
        that.dataService = data.dataService;
        that.container = null;

        that.getValues = function () {
            return that.values;
        };

        that.setValues = function (values) {
            that.attributes.forEach(function (el) {
                el.setValue(values[el.name] || el.value);
            });
        };

        /**
         * Creates the attributes of the item
         */
        that.init = function () {
            for (var key in that.definitions) {
                var definition = that.definitions[key];
                that.attributes.push(
                    new Attribute({
                        prefix: that.prefix,
                        value: that.values[key] || '',
                        definition: definition,
                        name: key,
                        dataService: that.dataService,
                        config: {
                            events: Events
                        }
                    })
                );
            }
        };

        /**
         * Gets the item
         * @returns {{}|*|values|_.values}
         */
        that.getValues = function () {

            that.attributes.forEach(function (attribute) {
                that.values[attribute.name] = attribute.getValue();
            });

            return that.values;
        };

        /**
         * Generates the HTML object containing the editable attributes
         * @param imageData
         * @param fieldDefinitions
         * @returns {jQuery|HTMLElement}
         */
        that.render = function (imageData, fieldDefinitions) {

            that.container = $('<ul class="col-xs-12 col-sm-8 col-md-8 imageservice-attributes"></ul>');

            that.attributes.forEach(function (el, index) {
                that.container.append(el.render());
                el.trigger(Events.ATTRIBUTERENDERED, el);
            });

            return that.container;
        };

        that.init();
    }
});