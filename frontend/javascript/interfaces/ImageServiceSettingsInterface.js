define(function(){

    /**
     * Interface / Abstract object for Settings-Blocks
     */
    return function(data) {

        this.Events = data.config.events;

        // The host where the events go
        this.host = data.host;

        this.name = 'ImageServiceSettings';

        // Creates an attributes object this will be used for the UI
        this.attributes = data.factory.attributes.create({
            definitions: data.attributes,
            dataService: data.service,
            values: data.values,
            prefix: this.name
        });

        this.getIdentifier = function () {
            return this.name;
        };

        this.getValues = function () {
            return this.attributes.getValues();
        };

        this.setValues = function (values) {
            this.attributes.setValues(values);
        };

        /**
         * Renders the frontend part
         * @returns {null|jQuery|HTMLElement|*}
         */
        this.render = function () {};

        /**
         * Initialization
         */
        this.registerSetting = function () {
            this.host.trigger(this.Events.SETTINGREGISTER, this);
        };

    }
});