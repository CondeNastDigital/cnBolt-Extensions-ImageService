/**
 * Created by ralev on 05.04.17.
 */
define(function(options) {

    return function(options) {

        var that = this;
        var host = options.host;
        var components = [];
        var container = null;
        var store = options.data || {};
        var Events = options.config.events;
        var Labels = options.config.labels.ImageServiceSettings;

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