define(function () {

    /**
     * A component which renders a set of Attributes and ahndeles them as one thing. Used by the ImageServicePresets,
     * ImageServiceGlobals and ImageServiceListItem.
     * @param data {Object}
     * @param data.model {Object} Holds all the Model Classes needed by the Class
     * @param data.model.attribute {ImageServiceAttribte} The model of a single attribute, used for rendering the Attributes
     * @param data.config {Object} Holds some global configs for the Instance
     * @param data.config.events {Object} Key-Value object, holding the events used by the class. So Far nur ATTRIBUTERENDERED is needed
     * @param data.values {Object} Key-Value object, holding the attributes initial values
     * @param data.definitions {Object} A set of Attributes definitions.
     * @param data.prefix {String} Prefix used for the unique names of the attributes
     * @param data.dataService {ImageSeviceConnector} Data service for the type-a-head fields
     *
     */
    return function(data) {

        var that = this;

        /**
         * Attributes Class/Factory that used to generate the single attribute fields
         * @type {*}
         */
        var Attribute = data.model.attribute;

        /**
         * Event names that the class knows
         */
        var Events = data.config.events;

        /**
         * Initial state
         * @type {Array}
         */
        that.values = data.values || [];

        /**
         * Fields name prefix
         * @type {string}
         */
        that.prefix = data.prefix || '';

        /**
         * Field Definitions
         */
        that.definitions = data.definitions;

        /**
         * The attributes
         * @type {Array}
         */
        that.attributes = [];

        /**
         * Data Service where the attributes get their data from
         */
        that.dataService = data.dataService;

        /**
         * The DOM element containing all the attributes
         * @type {null}
         */
        that.container = null;

        /**
         * Gets the set of attribute values
         * @returns {Array|*}
         */
        that.getValues = function () {
            return that.values;
        };

        /**
         * Sets the attribute values
         * @param values
         */
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