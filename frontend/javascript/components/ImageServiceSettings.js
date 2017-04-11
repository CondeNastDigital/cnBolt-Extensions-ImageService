define(function(options) {

    /**
     * A Component that renders a Settings Module, where the settings sub-blocks can register themselves
     * The component saves the data in the json store.
     * @param options {Object}
     * @param options.data {Object} Initial data for the Component
     * @param options.config {Object} System-wide config
     * @param options.config.event {Object} Event names that the component uses, SETTINGREGISTER
     * @param options.config.labels {Object} Labels for the component
     */
    return function(options) {

        var that = this;
        var host = options.host;
        var components = [];
        var container = null;
        var store = options.data || {};
        var Events = options.config.events;
        var Labels = options.config.labels;

        this.init = function () {

            var containerControl = $('<div class="col-sm-1 col-xs-12 imageservice-settings-trigger"><button class="btn btn-secondary"><i class="fa fa-cogs" aria-hidden="true"></i></button></div>');
            container = $('<div class="col-xs-12 imageservice-settings" ><h4>' + Labels.title + '</h4></div>');

            containerControl.on('click', function (event) {
                event.preventDefault();
                event.stopPropagation();

                $(container).animate({height: 'toggle'});
            });

            host.append(containerControl);
            host.append(container.hide());

            host.on(Events.SETTINGREGISTER, function (event, data) {
                data.setValues(store[data.getIdentifier()] || {});
                that.addComponent(data);
            });

        };

        this.addComponent = function (component) {
            var newElement = $('<div class="imageservice-settings-component"></div>').append(component.render());
            components.push(component);
            container.append(newElement);
        };

        this.getData = function () {

            components.forEach(function (el) {
                store[el.getIdentifier()] = el.getValues();
            });

            return store;
        };

        this.init();
    }
});